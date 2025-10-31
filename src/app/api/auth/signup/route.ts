import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../../lib/mongo";
import {
  hashPassword,
  signJwt,
  validatePassword,
} from "../../../../..//lib/auth";
import { getRoleByName } from "../../../../../lib/userHelpers";
import { ObjectId } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, planId } = body ?? {};

    // Validate planId
    const validPlanIds = [1, 2, 3];
    if (!validPlanIds.includes(planId)) {
      return NextResponse.json(
        { success: false, error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    // validate types
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Email and password must be strings" },
        { status: 400 }
      );
    }

    // basic email format check
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // validate password using centralized helper
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return NextResponse.json(
        {
          success: false,
          error: pwCheck.message || "Password does not meet policy",
        },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const users = db.collection("users");

    const existing = await users.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "User already exists with that email" },
        { status: 409 }
      );
    }

    // Get the 'user' role
    const userRole = await getRoleByName("user");
    if (!userRole) {
      return NextResponse.json(
        {
          success: false,
          error: "User role not found. Please run role initialization.",
        },
        { status: 500 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newUser = {
      email: email.toLowerCase(),
      passwordHash,
      password: passwordHash, // For compatibility
      roleId: new ObjectId(userRole._id),
      planId: planId,
      name: name ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      lastLogin: null,
    };

    const result = await users.insertOne(newUser);

    const userForClient = {
      _id: result.insertedId,
      email: newUser.email,
      name: newUser.name,
      roleId: newUser.roleId,
      planId: newUser.planId,
      createdAt: newUser.createdAt,
    };

    const token = signJwt(result.insertedId.toString());

    return NextResponse.json(
      { success: true, token, user: userForClient },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error("Signup error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
