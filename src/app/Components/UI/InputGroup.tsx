"use client";
import Label from "./Label";
import Input from "./Input";
import PasswordInput from "./PasswordInput";
import React from "react";

export default function InputGroup({
  id,
  label,
  ...props
}: {
  id: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const isPassword = props.type === "password";
  const Comp = isPassword ? PasswordInput : Input;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Comp id={id} {...props} />
    </div>
  );
}
