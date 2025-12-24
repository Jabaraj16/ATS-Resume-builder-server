const User = require('../models/User');
const jwt = require('jsonwebtoken');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// @desc    Register user & Send OTP
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now

        const user = await User.create({
            name,
            email,
            password,
            otp,
            otpExpires,
            isVerified: false
        });

        // Send OTP via Email
        const message = `Your OTP for Resume Builder registration is: ${otp}\n\nIt expires in 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Resume Builder - Email Verification OTP',
                message
            });

            res.status(200).json({
                success: true,
                message: 'OTP sent to email. Please verify to complete registration.',
                email: user.email // Send back email to help frontend context
            });
        } catch (err) {
            console.error(err);
            // If email fails, delete user so they can try again (or handle gracefully)
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({ success: false, message: 'Email could not be sent. Please try again.' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const user = await User.findOne({ email }).select('+otp +otpExpires');

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'User already verified. Please login.' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP expired. Please resend.' });
        }

        // Verify User
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        sendTokenResponse(user, 200, res);

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ success: false, message: 'User already verified' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        const message = `Your new OTP for Resume Builder registration is: ${otp}\n\nIt expires in 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Resume Builder - Resend OTP',
                message
            });

            res.status(200).json({ success: true, message: 'OTP resent to email' });
        } catch (err) {
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide an email and password' });
        }

        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ success: false, message: 'This email is not registered' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        // Check Verification
        if (!user.isVerified) {
            return res.status(401).json({
                success: false,
                message: 'Email not verified. Please verify your email.',
                isVerified: false
            });
        }

        sendTokenResponse(user, 200, res);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        const message = `Your OTP for password reset is: ${otp}\n\nIt expires in 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Resume Builder - Password Reset OTP',
                message
            });

            res.status(200).json({ success: true, message: 'OTP sent to email for password reset' });
        } catch (err) {
            user.otp = undefined;
            user.otpExpires = undefined;
            await user.save();
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email }).select('+otp +otpExpires');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        user.password = newPassword;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successful. You can now login.' });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper function to get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
    // Create token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d'
    });

    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
};
