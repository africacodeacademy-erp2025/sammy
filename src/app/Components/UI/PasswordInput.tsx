"use client";
import React, { useState } from "react";
import Input from "./Input";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export default function PasswordInput({ className, ...props }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? "text" : "password"}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        aria-label={show ? "Hide value" : "Show value"}
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-200 focus:outline-none"
      >
        {show ? (
          // Eye-off icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M3 3l18 18" />
            <path d="M2 12s4-7 10-7c2.34 0 4.35.87 6.03 2.05M22 12s-4 7-10 7c-2.34 0-4.35-.87-6.03-2.05" />
            <path d="M9.88 9.88A3 3 0 0012 15a3 3 0 002.12-.88" />
          </svg>
        ) : (
          // Eye icon
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
