import { requireUser } from "@/lib/auth";
import DocumentsClient from "@/components/DocumentsClient";


export default async function DocumentsPage() {
  const user = await requireUser();
  return <DocumentsClient canEdit={user.role === "admin"} />;
}
