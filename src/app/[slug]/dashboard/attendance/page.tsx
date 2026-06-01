import { redirect } from "next/navigation";

export default async function AttendanceIndex({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/dashboard/attendance/labour`);
}
