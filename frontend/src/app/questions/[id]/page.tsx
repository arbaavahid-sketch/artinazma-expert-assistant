import { redirect } from "next/navigation";

export default async function QuestionDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/questions/${id}`);
}