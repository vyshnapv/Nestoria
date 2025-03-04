const User = require("../../models/userModel");
const Wishlist = require("../../models/wishlistModel");
const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel")
const Cart = require("../../models/cartModel"); 

//get the wishlist
const wishlist = async (req, res) => {
  try {
    const userData = await User.findOne({ _id: req.session.user });
    const wishlist = await Wishlist.findOne({
      userId: req.session.user,
    }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category"
      }
    });

    if (wishlist) {
      wishlist.items = wishlist.items.filter(item => item.productId !== null);
      await wishlist.save();
    }

    const currentDate = new Date();
    const offers = await Offer.find({
      status: 'Active',
      expireDate: { $gt: currentDate }
    });

    const itemsWithOfferPrice = wishlist.items.map(item => {
      const product = item.productId;
      const productOffer = offers.find(offer =>
        (offer.productIds?.includes(product._id)) || (offer.categoryIds?.includes(product.category._id))
      );

      const offerPrice = productOffer
        ? product.regularPrice * (1 - productOffer.discount / 100)
        : product.regularPrice;

      return {
        ...item.toObject(),
        productId: {
          ...product.toObject(),
          offerPrice
        }
      };
    });

    res.render("wishlist", { userData, wishlist: { items: itemsWithOfferPrice } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Error fetching wishlist" });
  }
};


//add to wishlist
const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
        return res.status(401).json({ success: false,message: "Please login to manage your wishlist"});
    }
    const { productId } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    let wishlist = await Wishlist.findOne({ userId });
    
    if (!wishlist) {
      wishlist = new Wishlist({
        userId,
        items: [{ productId }],
      });
      await wishlist.save();
      return res.status(200).json({ 
        success: true,
        message: "Product added to wishlist",
        wishlistCount: 1,
        isWishlisted: true 
      });
    }
      const existingItemIndex = wishlist.items.findIndex(
        (item) => item.productId.toString() === productId
      );
      
      if (existingItemIndex === -1) {
        wishlist.items.push({ productId });
        await wishlist.save();
        
        return res.status(200).json({ success: true,message: "Product added to wishlist",wishlistCount: wishlist.items.length,isWishlisted: true });
      } else {
        wishlist.items.splice(existingItemIndex, 1);
      await wishlist.save();
      return res.status(200).json({ 
        success: true,
        message: "Product removed from wishlist",
        wishlistCount: wishlist.items.length,
        isWishlisted: false 
      });
    }
  } catch (error) {
    console.error("Error adding to wishlist:", error);
    res.status(500).json({success: false,message: "Error adding product to wishlist",});
  }
};

//remove from wishlist
const removeFromWishlist = async (req, res) => {
    try {
      const userId = req.session.user;
      if (!userId) {
        return res.status(401).json({success: false,message: "Please login to remove items from your wishlist"});
      }
  
      const { productId } = req.body;
  
      const wishlist = await Wishlist.findOne({ userId });
  
      if (!wishlist) {
        return res.status(404).json({success: false,message: "Wishlist not found"});
      }
  
      wishlist.items = wishlist.items.filter(
        item => item.productId.toString() !== productId
      );
  
      await wishlist.save();
  
      res.status(200).json({ 
        success: true, 
        message: "Product removed from wishlist",
        wishlistCount: wishlist.items.length 
      });
  
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      res.status(500).json({
        success: false,
        message: "Error removing product from wishlist",
      });
    }
  };

module.exports = {
  wishlist,
  addToWishlist,
  removeFromWishlist,
};
