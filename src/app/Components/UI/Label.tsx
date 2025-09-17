"use client";
import React from "react";

export default function Label(
  props: React.LabelHTMLAttributes<HTMLLabelElement>
) {
  return (
    <label
      className={`block text-sm font-medium text-gray-300 ${
        props.className ?? ""
      }`}
      {...props}
    >
      {props.children}
    </label>
  );
}
