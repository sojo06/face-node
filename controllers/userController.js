import User from '../models/User.js';

export const createUser = async (req, res) => {
  try {
    const { name, email, role, department, division } = req.body;

    if (!name || !email || !role || !department || !division) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const user = await User.create({ name, email, role, department, division });
    res.status(201).json({ message: 'User created successfully', user });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};