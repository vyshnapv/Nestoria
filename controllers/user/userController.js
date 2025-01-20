const env=require("dotenv").config();
const Category = require("../../models/categoryModel");
const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Address = require("../../models/addressModel")
const Wishlist = require("../../models/wishlistModel");
const bcrypt = require('bcrypt');
const nodemailer=require("nodemailer")
const session=require("express-session")


// Password Hashing
const hashPassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        return passwordHash;
    } catch (error) {
        console.log("Error hashing password:",error.message);
        throw error;
    }
};


//generate otp
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


//sendverificationEmail
async function sendverificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            }
        });

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Verify your account",
            text: `Your OTP is ${otp}`, 
            html: `<b>Your OTP: ${otp}</b>`, 
        });

        return info.accepted.length > 0; 

    } catch (error) {
        console.error("Error sending email:", error.message); 
        return false;
    }
}



//load home page
const loadHome = async (req, res) => {
    try {
        const userData =await User.findById(req.session.user);
        const products=await Product.find({ isBlocked: false })
        const categories=await Category.find({isListed:true});
        res.render('home', { userData ,products,categories});

    } catch (error) {
        console.error("Error loading home page", error);
        res.redirect("/pageNotFound");
    }
};



//load register page
const loadRegister=async(req,res)=>
{
    try{
        res.render("register")
    }
    catch(error)
    {
        console.error("error in loadregister:",error)
    }
}


//load login page
const loadLogin=async(req,res)=>
{
    try{
        res.render("login")
    }
    catch(error)
    {
     console.error("error from login page",error)
    }
}


//insert new user(signup)
const insertUser=async(req,res)=>
    {
        try {
            const { name, email, mobile, pass, re_pass } = req.body;
            
            if(pass !== re_pass)
            {
                return res.json({success:false,message:"passwords do not match"})
            }
           
            const findUser=await User.findOne({email})
    
            if(findUser)
            {
                return res.json({success:false,message:"user with this email already exist"})
            }
    
            const otp=generateOTP();

            const emailSend=await sendverificationEmail(email,otp);
    
            if(!emailSend)
            {
                return res.json({success:false,message: "Email error" });
            }

        req.session.userOtp=otp;
        req.session.userData={name,mobile,email,pass};
        
        res.json({success:true,message: "Registered successfully" });
        console.log("OTP send",otp);
    
        } catch (error) {
            console.error("sign-up error",error);
            res.redirect("/pageNotFound")
        }
    }

//otp page loading
    const otpPage=async(req,res)=>{
        try {
            res.render("verify-otp")
        } catch (error) {
            console.error(error);
            
        }
    }


 //verify otp
 const verifyOtp=async(req,res)=>
    {
       try {
           const {otp}=req.body;
           console.log(otp);
   
           if(otp===String(req.session.userOtp))
           {
               const user=req.session.userData;
               const passwordHash=await hashPassword(user.pass);
               const saveUserData=new User({
                   name:user.name,
                   email:user.email,
                   mobile:user.mobile,
                   password:passwordHash,
                   is_verified:true
               })
   
               await saveUserData.save();
   
               req.session.user=saveUserData._id;
               req.session.userOtp = null; 
               req.session.userData = null; 
               res.json({success:true,message:"Registration successful!",redirect:"/login"})
           }
           else
           {
               res.status(400).json({success:false,message:"Invalid otp,please try again"})
           }
           
       } catch (error) {
           console.error("Error verifying otp",error);
           res.status(500).json({success:false,message:"An error occure"})
       }
    }
      
//Resend OTP
const resendOtp=async(req,res)=>
    {
       try {
             const userData=req.session.userData;
             const otp=generateOTP();
   
             const emailSend=await sendverificationEmail(userData.email,otp);
             if(emailSend)
             {
               req.session.userOtp=otp;
               console.log("New OTP send:",otp);
               return res.json({success:true,message:"OTP resent successfully"});
             }
             else
             {
               return res.json({success:true,message:"Failed to resend otp,try again"});
             }
       } catch (error) {
             console.error("Error resending otp",error);
             res.status(500).json({success:false,message:"An error occured"});
             
       }
    }
   


//login user
const loginUser=async(req,res)=>
    {
       try{
            const email=req.body.email;
            const pass=req.body.pass;

           const userData =await User.findOne({is_admin:false,email:email})

             if(!userData)
             {
                return res.render("login",{message:"User not found"})
             }

             if(userData.is_blocked)
             {
              return res.render("login",{message:"User is blocked by admin"})
             }
             

             const passwordMatch=await bcrypt.compare(pass,userData.password)

             if(!passwordMatch)
             {
                return res.render("login",{message:"Incorrect Password"})
             }

             req.session.user=userData._id;
             res.redirect("/")
             
            }catch(error)
             {
             console.log("login error:",error);
             res.render("login",{message:"login failed,please try again later"})
             }
        }

//logout user
const logoutUser = async (req, res) => {
    try {
        req.session.destroy((err)=>
        {
            if(err)
            {
                console.log("session destructuring error",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
      
    } catch (error) {
        console.log("Error during logout:", error);
       re.redirect("pageNotFound")
    }
};

//user profile
const profile =async (req,res) =>{
    try {
        const userData = await User.findById(req.session.user);
        res.render("profile", { userData });
    } catch (error) {
        console.error("Error loading profile page:", error);
        res.redirect("/pageNotFound");
    }
};


//edit profile
const editProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { name, mobile } = req.body;

        const existingUser = await User.findOne({
            mobile: mobile.trim(),
            _id: { $ne: userId }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "This mobile number is already registered with another account"
            });
        }

        
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                name,
                mobile: mobile.trim()
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            message: "Profile updated successfully"
        });

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            success: false,
            message: "An error occurred while updating profile"
        });
    }
};

//load change password
const loadEditPassword = async (req,res)=>{
    try {
        const userData = await User.findById(req.session.user);

        const userDataForView = {
            ...userData.toObject(),
            password: ''
        };
        
        res.render("editpassword",{userData:userDataForView})
        
    } catch (error) {
        console.error("Error loading home page", error);
        res.redirect("/pageNotFound");
        
    }
}

//change password
const changePassword = async (req,res) =>{
    try {
        const userId=req.session.user;
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({  success: false, message: "All fields are required." ,  field: !currentPassword ? 'currentPassword' : !newPassword ? 'newPassword' : 'confirmPassword'});
        }

        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({ success:false,message:"User not found."});
        }

        const hashedPassword = await hashPassword(newPassword);

        user.password = hashedPassword;
        await user.save();

        res.json({ success: true, message: "Password changed successfully." });
        
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ success: false, message: "An error occurred. Please try again later." });
    }
}


//shop page 
 const shop = async (req, res) => {
    try {
        const userData =await User.findById(req.session.user);
        
        let wishlistedProducts = [];
        if (userData) {
           const wishlist = await Wishlist.findOne({ userId: userData._id });
         if (wishlist) {
            wishlistedProducts = wishlist.items.map(item => item.productId.toString());
         }
        }

        const selectedCategory = req.query.Category;
        const searchQuery = req.query.q ? req.query.q.trim() : '';

    const listedCategories = await Category.aggregate([
        { $match: { isListed: true } },
        {
            $lookup: {
                from: "products", 
                let: { categoryId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$category", "$$categoryId"] }, isBlocked: false } } 
                ],
                as: "products"
            }
        },
        {
            $addFields: {
                count: { $size: "$products" } 
            }
        },
        {
            $project: { _id: 1, name: 1, count: 1 } 
        }
    ]);

      const categoryIds = listedCategories.map(category => category._id);
  
      let filter = { isBlocked: false };

      if (selectedCategory) {
        const category = await Category.findOne({ name: selectedCategory, isListed: true });
        if (category) {
          filter.category = category._id; 
        }
      } else {
        filter.category = { $in: categoryIds }; 
      }

      if (searchQuery) {
        // Create case-insensitive word boundary search
        const searchTerms = searchQuery.trim().split(/\s+/);
        
        filter.$or = [
            { 
                productName: { 
                    $regex: new RegExp(searchTerms.map(term => `\\b${term}`).join('|'), 'i') 
                }
            }
        ];
      }
  
      const page = parseInt(req.query.page) || 1; 
      const limit = 9; 
      const skip = (page - 1) * limit; 
      const totalProducts = await Product.countDocuments(filter);
      const totalPages = Math.ceil(totalProducts / limit);

      let sortOption = {};
        let priceSort = req.query['price-sort']; 
        const nameSort = req.query['name-sort'];


        if (priceSort === 'lowToHigh') {
            sortOption.salePrice = 1;
        } else if (priceSort === 'highToLow') {
            sortOption.salePrice = -1;
        }

        const sortStage = [
            { $match: filter },
        ];

        if (nameSort === 'aToZ') {
            sortStage.push({ $addFields: { lowerName: { $toLower: "$productName" } } });
            sortStage.push({ $sort: { lowerName: 1 } });
        } else if (nameSort === 'zToA') {
            sortStage.push({ $addFields: { lowerName: { $toLower: "$productName" } } });
            sortStage.push({ $sort: { lowerName: -1 } });
        } else if (Object.keys(sortOption).length > 0) {
            sortStage.push({ $sort: sortOption });
        }

        sortStage.push({ $skip: skip });
        sortStage.push({ $limit: limit });
     
       const products = await Product.aggregate(sortStage);

       const productsWithWishlistStatus = products.map(product => ({
        ...product,
        isWishlisted: wishlistedProducts.includes(product._id.toString())
      }));

      res.render("shop", {
          products: productsWithWishlistStatus,
          userData,
          category: listedCategories,
          selectedCategory,
          currentPage: page,
          totalPages,
          priceSort,
          nameSort,
          searchQuery
      });
  } catch (error) {
      console.error("Error in shop", error);
      res.status(500).json({ success: false, message: "An error occurred" });
  }
};

  
//product detailed page
const productDetails=async(req,res)=>{
  try {
    const userData=await User.findById(req.session.user);
  
    const productId=req.params.id;

    const product=await Product.findOne({_id:productId}).populate("category")

    if (!product || !product.category || !product.category.isListed) {
        return res.redirect("/shop");
      }

    let isWishlisted = false;
    if (userData) {
        const wishlist = await Wishlist.findOne({ userId: userData._id });
        if (wishlist) {
            isWishlisted = wishlist.items.some(item => 
                item.productId.toString() === productId
            );
        }
    }

    const categories=await Category.find({isListed:true});
    res.render("product",{product,userData,categories,isWishlisted})
    
  } catch (error) {
    console.error("Error in productdetails",error);
   res.render("404")
  }
}


//page not found
const pageNotFound=async(req,res)=>
    {
      try {
          res.render("404")
      } catch (error) {
        res.redirect("/pageNotFound")
      }
    }

//load address page
const loadAddress = async (req,res)=>{
    try {
        const userData = await User.findById(req.session.user);
        const addressData = await Address.findOne({ userId: userData._id });
        res.render("address",{userData, addresses:addressData || { address: [] }})
    } catch (error) {
        console.error("Error loading home page", error);
        res.redirect("/pageNotFound");
    }
}

const addAddress = async (req,res)=>{
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Please login to add address" });
        }

        const { name, phone, district, city, house, state, pincode } = req.body;

        if (!name || !phone || !district || !city || !house || !state || !pincode) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const newAddress = {
            name,
            phone,
            district,
            city,
            house,
            state,
            pincode
        };

        let addressDoc = await Address.findOne({ userId: req.session.user });
        
        if (addressDoc) {
            addressDoc.address.push(newAddress);
            await addressDoc.save();
        } else {
            addressDoc = new Address({
                userId: req.session.user,
                address: [newAddress]
            });
            await addressDoc.save();
        } 
        res.redirect('/address');

    } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).json({ success: false, message: "Failed to add address" });
    }
};

//load edit address
const loadEditAddress = async (req, res) => {
    try {

        const userData = await User.findById(req.session.user);

        const addressId = req.params.addressId;
        const addressIndex = parseInt(req.params.index);

        const addressDoc = await Address.findById(addressId);
        
        if (!addressDoc || !addressDoc.address[addressIndex]) {
            return res.redirect("/address");
        }

        if (addressDoc.userId.toString() !== req.session.user) {
            return res.redirect("/address");
        }

        const address = addressDoc.address[addressIndex];

        res.render("editAddress", {
            userData,
            address,
            addressId,
            index:addressIndex
        });

    } catch (error) {
        console.error("Error loading edit address page:", error);
        res.redirect("/address");
    }
};


//edit adddress
const editAddress = async (req, res) => {
    try {

        const { name, phone, district, city, house, state, pincode } = req.body;
        const addressId = req.params.addressId;
        const addressIndex = parseInt(req.params.index);

        // Validation
        if (!name || !phone || !district || !city || !house || !state || !pincode) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const addressDoc = await Address.findById(addressId);
        
        if (!addressDoc || !addressDoc.address[addressIndex]) {
            return res.redirect("/address");
        }

        if (addressDoc.userId.toString() !== req.session.user) {
            return res.redirect("/address");
        }


        addressDoc.address[addressIndex] = {
            name,
            phone,
            district,
            city,
            house,
            state,
            pincode
        };

        await addressDoc.save();
        
        res.redirect('/address');

    } catch (error) {
        console.error("Error editing address:", error);
        res.redirect("/address");
    }
};

//delete address
const deleteAddress = async (req, res) => {
    try {

        const addressId = req.params.addressId;
        const index = parseInt(req.params.index);

        const addressDoc = await Address.findById(addressId);

        if (!addressDoc) {
            return res.json({ success: false, message: "Address not found" });
        }

        if (addressDoc.userId.toString() !== req.session.user) {
            return res.json({ success: false, message: "Unauthorized" });
        }


        addressDoc.address.splice(index, 1);

    
        if (addressDoc.address.length === 0) {
            await Address.findByIdAndDelete(addressId);
        } else {
            
            await addressDoc.save();
        }

        res.json({ success: true, message: "Address deleted successfully" });

    } catch (error) {
        console.error("Error deleting address:", error);
        res.json({ success: false, message: "Failed to delete address" });
    }
};
  


module.exports = {
    loadHome,
    loadRegister,
    loadLogin,
    insertUser,
    otpPage,
    verifyOtp,
    resendOtp,
    loginUser,
    logoutUser,
    profile,
    editProfile,
    loadEditPassword,
    changePassword,
    shop,
    productDetails,
    pageNotFound,
    loadAddress,
    addAddress,
    loadEditAddress,
    editAddress,
    deleteAddress 
}