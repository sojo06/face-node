// middleware/protect.js

import jwt from "jsonwebtoken";

import User from "../models/User.js";

const protect = async (req, res, next) => {
  // Check for auth token in headers
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch the user from the database (assuming 'User' has department and division info)
    const user = await User.findById(decoded.id);
    console.log(user)
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach department and division to the request object
    req.user = {
      id: user._id,
      department: user.department,
      division: user.division,
    };
    req.body.department = user.department;
    req.body.division = user.division;
    

    next(); // Pass to the next middleware or route handler
  } catch (error) {
    console.error("Error in token verification:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

export default protect;
