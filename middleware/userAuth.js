const User = require("../models/userModel");

const userAuth = async (req, res, next) => {
  try {
    if (req.session.user) {
      const user = await User.findById(req.session.user);
      if (user && !user.is_blocked) {
        return next();
      }
    }
    res.redirect("/login");
  } catch (error) {
    console.error("Error in user authentication middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};


const userNotAuth = async (req, res, next) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }
    next(); 
  } catch (error) {
    console.error("Error in user not authenticated middleware:", error);
    res.status(500).send("Internal Server Error");
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
    res.json({ success: false }); 
  } catch (error) {
    console.error("Error in user authentication middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};


const adminAuth = (req, res, next) => {
  try {
    if (req.session.admin) {
      next();
    } else {
      return res.redirect("/admin/login");
    }
  } catch (error) {
    console.error(error);
  }
};


const adminAuth1 = (req, res, next) => {
  try {
    if (req.session.admin) {
      return res.redirect("/admin");
    } else {
      next();
    }
  } catch (error) {
    console.error(error);
  }
};


module.exports = {
  userAuth,
  userAuth1,
  userNotAuth,
  adminAuth,
  adminAuth1,
};


