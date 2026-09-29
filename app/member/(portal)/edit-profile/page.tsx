import EditMemberProfile from "../components/EditMemberProfile";
import { getBranches, getDepartments } from "./data";
import { getMemberFieldDefinitions } from "@/lib/member-fields";

export default async function EditProfilePage() {
  const [branches, departments] = await Promise.all([
    getBranches(),
    getDepartments(),
  ]);
  const fieldDefinitions = await getMemberFieldDefinitions();

  return (
    <EditMemberProfile
      branches={branches}
      departments={departments}
      fieldDefinitions={fieldDefinitions}
    />
  );
}