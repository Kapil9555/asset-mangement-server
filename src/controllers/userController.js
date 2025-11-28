// controllers/userController.js
import User from '../models/User.js';

/**
 * @desc   Get all users (with optional search + pagination)
 * @route  GET /api/users
 * @access Private (admin)
 * @note   Admin accounts are never returned in this list
 */


export const getUsers = async (req, res, next) => {
  try {
    const {
      search = '',
      // role,          // we’ll ignore role=admin in filter to avoid returning admin
      isActive,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;

    const filter = {};

    if (search) {
      const q = new RegExp(search, 'i');
      filter.$or = [{ name: q }, { email: q }, { phoneNo: q }];
    }

    // ❌ Do not ever include admin accounts in the list
    filter.role = { $ne: 'admin' };

    if (isActive === 'true') filter.isActive = true;
    if (isActive === 'false') filter.isActive = false;

    const [items, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort('-createdAt')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      data: items,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};


/**
 * @desc   Get single user by ID
 * @route  GET /api/users/:id
 * @access Private (admin or self)
 * @note   Admin account is never returned
 */


export const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user || user.role === 'admin') {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ data: user });
  } catch (err) {
    next(err);
  }
};


/**
 * @desc   Create a new user
 * @route  POST /api/users
 * @access Private (admin)
 */


export const createUser = async (req, res, next) => {
  try {
    const { name, email, password, phoneNo, role, isActive } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password, // will be hashed by pre-save hook
      phoneNo: phoneNo || undefined,
      role: role || 'asset_manager',
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    const safeUser = user.toObject();
    delete safeUser.password;

    res.status(201).json({ data: safeUser });
  } catch (err) {
    next(err);
  }
};




/**
 * @desc   Update user (admin panel)
 * @route  PUT /api/users/:id
 * @access Private (admin)
 * @note   Admin account cannot be updated via this endpoint
 */


export const updateUser = async (req, res, next) => {
  try {
    const { name, email, password, phoneNo, role, isActive } = req.body;

    const user = await User.findById(req.params.id);

    if (!user || user.role === 'admin') {
      // either not found or we don't allow updating admin via this API
      return res.status(404).json({ message: 'User not found' });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email.toLowerCase();
    if (phoneNo !== undefined) user.phoneNo = phoneNo;
    if (role !== undefined) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    // if password provided, it will be re-hashed by pre-save hook
    if (password) {
      user.password = password;
    }

    const updated = await user.save();
    const safeUser = updated.toObject();
    delete safeUser.password;

    res.json({ data: safeUser });
  } catch (err) {
    next(err);
  }
};



/**
 * @desc   Delete user
 * @route  DELETE /api/users/:id
 * @access Private (admin)
 * @note   Admin account cannot be deleted
 */


export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user || user.role === 'admin') {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.deleteOne();

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
};
