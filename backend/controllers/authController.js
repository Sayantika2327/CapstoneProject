
import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || "7d",
    });
};

// @desc Register new user
// @route POST /api/auth/register
// @access Public
export const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: "Email already registered",
            });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
            return res.status(400).json({
                success: false,
                message: "Username already taken",
            });
        }

        const user = await User.create({
            username,
            email,
            password,
        });

        const token = generateToken(user._id);

        return res.status(201).json({
            success: true,
            message: "User registered successfully",
            data: {
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    profileImage: user.profileImage,
                    createdAt: user.createdAt,
                },
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Login user
// @route POST /api/auth/login
// @access Public
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        //Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Please provide both email and password",
                statusCode: 400,
            });
        }

        //Check for user(include password for comparison)
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
                statusCode: 401,
            });
        }

        //Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
                statusCode: 401,
            });
        }

        //Generate token
        const token = generateToken(user._id);

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
            },
            token,
            message: "Login successful",

        });

    } catch (error) {
        next(error);
    }
};

// @desc Get user profile
// @route GET /api/auth/profile
// @access Private
export const getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc Update user profile
// @route PUT /api/auth/profile
// @access Private
export const updateProfile = async (req, res, next) => {
    try {
        const { username, email, profileImage } = req.body;
        const user = await User.findById(req.user._id);

        if (username) user.username = username;
        if (email) user.email = email;
        if (profileImage) user.profileImage = profileImage;


        await user.save();

        res.status(200).json({
            success: true,
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,

            },
            message: "Profile updated successfully",
        });
    } catch (error) {
        next(error);
    }
};

// @desc Change password
// @route PUT /api/auth/change-password
// @access Private
export const changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: "Please provide both current and new password",
                statusCode: 400,
            });
        }
        const user = await User.findById(req.user._id).select('+password');
        // Check if current password matches
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: "Current password is incorrect",
                statusCode: 401,
            });
        }
        // Update to new password
        user.password = newPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password changed successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
