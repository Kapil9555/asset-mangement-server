import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';


const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phoneNo: {
       unique: true,
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['admin', 'asset_manager'],
      default: 'asset_manager',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);


// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};


const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
