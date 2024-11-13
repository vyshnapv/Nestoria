const User = require("../models/userModel");

const userAuth = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user && !user.is_blocked) {
        return next();
      }
    }
    return res.status(401).json({ success: false, message: "User is not authenticated or blocked" });
  } catch (error) {
    console.error("Error in user authentication middleware:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const userNotAuth = async (req, res, next) => {
  try {
    if (req.session.user) {
      return res.status(403).json({ success: false, message: "User already logged in" });
    }
    next();
  } catch (error) {
    console.error("Error in user not authenticated middleware:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const userAuth1 = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user && !user.is_blocked) {
        return next(); 
      }
    }
    return res.status(401).json({ success: false, message: "User is not authenticated or blocked" });
  } catch (error) {
    console.error("Error in user authentication middleware:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const adminAuth = (req, res, next) => {
  try {
    if (req.session.admin) {
      return next();
    } else {
      return res.status(403).json({ success: false, message: "Admin not authenticated" });
    }
  } catch (error) {
    console.error("Error in admin authentication:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const adminAuth1 = (req, res, next) => {
  try {
    if (req.session.admin) {
      return res.status(403).json({ success: false, message: "Admin already logged in" });
    } else {
      return next();
    }
  } catch (error) {
    console.error("Error in admin not authenticated:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  userAuth,
  userAuth1,
  userNotAuth,
  adminAuth,
  adminAuth1,
};
