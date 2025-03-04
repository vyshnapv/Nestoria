const Product = require("../../models/productModel");
const Offer = require("../../models/offerModel");
const Category = require("../../models/categoryModel");

//offer management page
const offerManagement=async(req,res)=>{
    try {
        const search=req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 7;
        const query={
            $or:[
                {offerName:{$regex:search,$options:'i'}},
                {offerType:{$regex:search,$options:'i'}},
            ]
        };

        const totalOffers = await Offer.countDocuments(query);
        const totalPages = Math.ceil(totalOffers / limit);

        const offers = await Offer.find(query)
            .populate('productIds', 'productName')
            .populate('categoryIds', 'categoryName')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const currentDate=new Date();
        const processedOffers = offers.map(offer=>{
            const isExpired = offer.expireDate < currentDate;
            return{
                ...offer._doc,
                status:isExpired?"Expired":offer.status,
                formattedExpiryDate:offer.expireDate.toISOString().split('T')[0]
            };
        });

        res.render("offerManagement", {
            offers: processedOffers,
            currentPage: page,
            totalPages: totalPages,
            search: search,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        });
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
        });
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
        }
            const offer = new Offer({
                offerType: "Product",
                offerName: offerName,
                discount: discount,
                expireDate: expiry,
                productIds: productIds,
                status: 'Active'
            });

            await offer.save();
        
        res.status(200).json({success: true,message: "Offers created successfully"});
    } catch (error) {
        console.error("Error creating offer:", error);
        res.status(500).json({success: false,message: "Failed to create offer. Please try again."});
    }
}

//load edit product offer
const loadEditProductOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await Offer.findById(offerId).populate('productIds');
        
        if (!offer) {
            return res.redirect('/admin/offerManagement');
        }

        const activeProducts = await Product.find({
            isBlocked: false,
        });

        res.render('editProductOffer', {
            offer: offer,
            products: activeProducts
        });
    } catch (error) {
        console.error("Error loading edit product offer page:", error);
        res.redirect("/pageerror");
    }
};

//update product offer
const updateProductOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const { offerName, discountPercentage, selectedProducts, expiryDate } = req.body;

        if (!offerName || !discountPercentage || !selectedProducts || !expiryDate) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        const discount = parseFloat(discountPercentage);
        if (isNaN(discount) || discount <= 0 || discount > 50) {
            return res.status(400).json({ success: false, message: "Discount percentage must be between 0 and 50" });
        }

        const expiry = new Date(expiryDate);
        const now = new Date();
        if (expiry <= now) {
            return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
        }
        const productIds = Array.isArray(selectedProducts) ? selectedProducts : [selectedProducts];
        
        for (const productId of productIds) {
            const product = await Product.findOne({ _id: productId, isBlocked: false });
            if (!product) {
                return res.status(404).json({ success: false, message: `Product not found or inactive: ${productId}` });
            }
        }

        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerName: offerName,
                discount: discount,
                expireDate: expiry,
                productIds: productIds,
                status: 'Active'
            },
            { new: true }
        );

        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        res.status(200).json({ success: true, message: "Offer updated successfully" });
    } catch (error) {
        console.error("Error updating product offer:", error);
        res.status(500).json({ success: false, message: "Failed to update offer" });
    }
};


//load category offer page
const loadCategoryOffer= async(req,res)=>{
    try {
        const activeCategories=await Category.find({
            isListed:true,
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
        }
            const offer=new Offer({
                offerType:"Category",
                offerName:offerName,
                discount:discount,
                expireDate:expiry,
                categoryIds:categoryIds,
                status:"Active"
            });

            await offer.save();

        res.status(200).json({success:true,message:"Category offers created successfully"});
    } catch (error) {
        console.error("Error creating category offer:", error);
        res.status(500).json({success:false,message:"Failed to create offer.Please try again."})
    }
}

// Load edit category offer
const loadEditCategoryOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await Offer.findById(offerId).populate('categoryIds')
        
        if (!offer) {
            return res.redirect('/admin/offerManagement');
        }

        const activeCategories = await Category.find({
            isListed: true
        });

        res.render('editCategoryOffer', {
            offer: offer,
            categories: activeCategories
        });
    } catch (error) {
        console.error("Error loading edit category offer page:", error);
        res.redirect("/pageerror");
    }
};

// Update category offer
const updateCategoryOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const { offerName, discountPercentage, selectedCategories, expiryDate } = req.body;

        if (!offerName || !discountPercentage || !selectedCategories || !expiryDate) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        const discount = parseFloat(discountPercentage);
        if (isNaN(discount) || discount <= 0 || discount > 50) {
            return res.status(400).json({ success: false, message: "Discount percentage must be between 0 and 50" });
        }

        const expiry = new Date(expiryDate);
        const now = new Date();
        if (expiry <= now) {
            return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
        }

        const categoryIds = Array.isArray(selectedCategories) ? selectedCategories: selectedCategories;

        for(const categoryId of categoryIds){
           const category = await Category.findOne({ _id: categoryId, isListed: true });
             if (!category) {
               return res.status(404).json({ success: false, message: "Category not found or inactive" });
            }
        }
        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerName: offerName,
                discount: discount,
                expireDate: expiry,
                categoryIds: categoryIds,
                status: 'Active'
            },
            { new: true }
        );

        if (!updatedOffer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        res.status(200).json({ success: true, message: "Offer updated successfully" });
    } catch (error) {
        console.error("Error updating category offer:", error);
        res.status(500).json({ success: false, message: "Failed to update offer" });
    }
};

//status updation
const toggleOfferStatus = async(req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await Offer.findById(offerId);

        if (!offer) {
            return res.status(404).json({success: false, message: "Offer not found"});
        }

        const currentDate = new Date();

        if (offer.status === "Inactive" && offer.expireDate < currentDate) {
            return res.status(200).json({
                success: false,
                isExpired: true,
                offerType: offer.offerType,
                message: "Cannot activate expired offer"
            });
        }

        offer.status = offer.status === "Active" ? "Inactive" : "Active";
        await offer.save();

        res.status(200).json({
            success: true,
            message: "Offer status updated successfully",
            newStatus: offer.status
        });
    } catch (error) {
        console.error("Error toggling offer status", error);
        res.status(500).json({ success: false, message: "Failed to update offer status" });
    }
}

//delete offer
const deleteOffer = async (req, res) => {
    try {
        const offerId = req.params.id;
        const offer = await Offer.findByIdAndDelete(offerId);

        if (!offer) {
            return res.status(404).json({ success: false, message: "Offer not found" });
        }

        res.status(200).json({ success: true, message: "Offer deleted successfully" });
    } catch (error) {
        console.error("Error deleting offer:", error);
        res.status(500).json({ success: false, message: "Failed to delete offer" });
    }
};

module.exports={
    offerManagement,
    loadProductOffer,
    createProductOffer,
    loadEditProductOffer,
    updateProductOffer,
    loadCategoryOffer,
    createCategoryOffer,
    loadEditCategoryOffer,
    updateCategoryOffer,
    toggleOfferStatus,
    deleteOffer
}