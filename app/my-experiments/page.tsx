import { redirect } from "next/navigation";

export default function MyExperimentsPage() {
  redirect("/my-work?section=experiments");
}
