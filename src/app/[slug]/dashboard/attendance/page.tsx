import { redirect } from "next/navigation";

export default function AttendanceIndex({ params }: { params: { slug: string } }) {
  redirect(`/${params.slug}/dashboard/attendance/labour`);
}
