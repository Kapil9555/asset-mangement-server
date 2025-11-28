import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (res, user) => {
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Attach as HTTP-only cookie
  res.cookie('am_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};


export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });

    if (!user)
      return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ message: 'Invalid email or password' });

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is inactive. Contact admin.' });
    }

    generateToken(res, user);

    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


export const getMe = async (req, res) => {
  try {
    // Check if req.user exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Unauthorized: User ID missing' });
    }

    // Fetch user from DB
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });

  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


export const logout = (req, res) => {
  try {
    // Clear the auth cookie
    res.clearCookie('am_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({ message: 'Server error logging out' });
  }
};

