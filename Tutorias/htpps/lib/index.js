"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserHttp = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.createUserHttp = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c;
    if (req.method !== 'POST') {
        res.set('Allow', 'POST');
        return res.status(405).json({
            error: 'Method Not Allowed',
            message: 'Use POST to create a user.'
        });
    }
    const { email, password, displayName } = (_a = req.body) !== null && _a !== void 0 ? _a : {};
    if (!email || !password) {
        return res.status(400).json({
            error: 'Invalid request',
            message: 'Both email and password are required.'
        });
    }
    try {
        const userRecord = await admin.auth().createUser({
            email,
            password,
            displayName
        });
        return res.status(201).json({
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName
        });
    }
    catch (error) {
        const firebaseError = error;
        const statusCode = firebaseError.code === 'auth/email-already-exists' ? 409 : 500;
        return res.status(statusCode).json({
            error: (_b = firebaseError.code) !== null && _b !== void 0 ? _b : 'internal-error',
            message: (_c = firebaseError.message) !== null && _c !== void 0 ? _c : 'Failed to create user.'
        });
    }
});
