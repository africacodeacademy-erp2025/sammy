import { redirect } from "next/navigation";
import ResetPasswordClient from "./ResetPasswordClient";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!token) {
    redirect("/");
  }

  return <ResetPasswordClient token={token as string} />;
}
