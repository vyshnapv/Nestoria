const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel");
const Category = require("../../models/categoryModel");

//offer management page
const offerManagement=async(req,res)=>{
    try {
        const search=req.query.search || "";
        const query={
            $or:[
                {offerName:{$regex:search,$options:'i'}},
                {offerType:{$regex:search,$options:'i'}},
            ]
        };

        const offers=await Offer.find(query).sort({createdAt:-1});

        const currentDate=new Date();
        const processedOffers = offers.map(offer=>{
            const isExpired = offer.expireDate < currentDate;
            return{
                ...offer._doc,
                status:isExpired?"Expired":offer.status,
                formattedExpiryDate:offer.expireDate.toISOString().split('T')[0]
            };
        });

        res.render("offerManagement",{offers:processedOffers})
    } catch (error) {
        console.error("Error in offer management:", error);
        res.redirect("/pageerror"); 
    }
}


//load product offer page 
const loadProductOffer=async(req,res)=>{
    try {
        const activeProducts=await Product.find({
            isBlocked:false,
            _id:{
                $nin:await Offer.distinct("productId",{
                    status:"Active",
                    expireDate:{$gt:new Date()}
                })
            }
        })
        res.render("productOffer",{products:activeProducts})
    } catch (error) {
        console.error("Error loading product offer page:", error);
        res.redirect("/pageerror");
    }
}

//create product offer
const createProductOffer = async(req,res)=>{
    try {
        const {offerName,discountPercentage,selectedProducts,expiryDate}=req.body;

        if(!offerName || !discountPercentage || !selectedProducts || !expiryDate){
            return res.status(400).json({success:false,message:"please fill all required fields"});
        }

        const discount=parseFloat(discountPercentage);
        if(isNaN(discount)|| discount <=0 || discount>50){
            return res.status(400).json({success:false,message:"Discount percentagemust be betweeen 0 and 50"})
        }

        const expiry=new Date(expiryDate);
        const now=new Date();
        if(expiry <= now){
            return res.status(400).json({success:false,message:"Expiry date must be in the future"});
        }

        const productIds=Array.isArray(selectedProducts)?selectedProducts:[selectedProducts];

        for(const productId of productIds){
            const product=await Product.findOne({_id:productId,isBlocked:false});
            if(!product){
               return res.status(404).json({success:false,message:`product not found or inactive:${productId}`});
            }

            const existingOffer = await Offer.findOne({
                productId: productId,
                status: 'Active',
                expireDate: { $gt: now }
            });

            if (existingOffer) {
                return res.status(400).json({
                    success: false,
                    message: `Product ${product.productName} already has an active offer`
                });
            }

            const offer = new Offer({
                productName: product.productName,
                offerType: "Product",
                offerName: offerName,
                discount: discount,
                expireDate: expiry,
                productId: productId,
                status: 'Active'
            });

            await offer.save();
        }
        res.status(200).json({success: true,message: "Offers created successfully"});
    } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).json({success: false,message: "Failed to create offer. Please try again."});
    }
}


//load category offer page
const loadCategoryOffer= async(req,res)=>{
    try {
        const activeCategories=await Category.find({
            isListed:true,
            _id:{
                $nin:await Offer.distinct("categoryId",{
                    status:"Active",
                    expireDate:{$gt:new Date()}
                })
            }
        });
        res.render("categoryOffer",{categories:activeCategories})
    } catch (error) {
        console.error("Error loading category offer page:", error);
        res.redirect("/pageerror");
    }
}

//createcategory controller 
const createCategoryOffer=async(req,res)=>{
    try {
        const {offerName,discountPercentage,selectedCategories,expiryDate}=req.body;

        if(!offerName || !discountPercentage || !selectedCategories || !expiryDate){
            return res.status(400).json({success:false,message:"Please fill all the reqired fields"})
        }

        const discount=parseFloat(discountPercentage);
        if(isNaN(discount) || discount<=0 || discount>50){
            return res.status(400).json({success:false,message:"Discount percentage muist be between 0 and 50"})
        }

        const expiry=new Date(expiryDate);
        const now=new Date()
        if(expiry <= now){
            return res.status(400).json({success:false,message:"Expiry date must be in the future"})
        }

        const categoryIds=Array.isArray(selectedCategories)?selectedCategories:[selectedCategories];

        for(const categoryId of categoryIds){
            const category=await Category.findOne({_id:categoryId,isListed:true});
            if(!category){
                return res.status(404).json({success:false,message:`Category not found or inactive: ${categoryId}`})
            }
            const existingOffer=await Offer.findOne({
                categoryId:categoryId,
                status:"Active",
                expireDate:{$gt:now}
            });

            if(existingOffer){
                return res.status(400).json({success:false,message:`Category ${category.name} already has an active offer`})
            }

            const offer=new Offer({
                categoryName:category.name,
                offerType:"Category",
                offerName:offerName,
                discount:discount,
                expireDate:expiry,
                categoryId:categoryId,
                status:"Active"
            });

            await offer.save();
        }

        res.status(200).json({success:true,message:"Category offers created successfully"});
    } catch (error) {
        console.error("Error creating category offer:", error);
        res.status(500).json({success:false,message:"Failed to create offer.Please try again."})
    }
}


module.exports={
    offerManagement,
    loadProductOffer,
    createProductOffer,
    loadCategoryOffer,
    createCategoryOffer,
}