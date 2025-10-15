"use client";
import { useRouter } from "next/navigation";
import RecurringPostsView from "../Components/RecurringPostsView";

export default function ManageRecurringPage() {
  const router = useRouter();

  const handleBack = () => {
    router.push("/chatbot");
  };

  return <RecurringPostsView onBack={handleBack} />;
}
