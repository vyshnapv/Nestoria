const User = require("../models/userModel");

const userAuth = async (req, res, next) => {
  try {
    if (req.session.user) {
      const userData = await User.findById(req.session.user);
      if (userData.is_blocked == false) {
        next();
    } else {
        delete req.session.user;
        return res.redirect('/login?blockMessage=You are blocked!');
    }
    }else{
    return res.redirect("/login");
    }
  } catch (error) {
    console.log(error.message);
  }
};


const userNotAuth = async (req, res, next) => {
  try {
    if (req.session.user) {
      return res.redirect("/");
    }else{
    next(); 
    }
  } catch (error) {
    console.error("Error in user not authenticated middleware:", error);
    res.status(500).send("Internal Server Error");
  }
};

//for post method
const userAuth1 = async (req, res, next) => {
  try {
    if (req.session.user) {
      const userData = await User.findById(req.session.user);
      if (userData.is_blocked === false) {
        next();
      } else {
        delete req.session.user;
        return res.status(403).json({success: false,message: "You are blocked!",});
      }
    } else {
      return res.status(401).json({success: false,message: "Unauthorized access. Please log in.",});
    }
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({success: false,message: "An error occurred while processing your request.",});
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


