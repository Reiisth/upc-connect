import EditMemberProfile from "../components/EditMemberProfile";
import { getBranches, getDepartments } from "./data";

export default async function EditProfilePage() {
  const [branches, departments] = await Promise.all([
    getBranches(),
    getDepartments(),
  ]);

  return (
    <EditMemberProfile
      branches={branches}
      departments={departments}
    />
  );
}