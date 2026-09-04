import { inviteMember } from "../actions";

export default function TestInvitePage() {
  async function action(formData: FormData) {
    "use server";

    const memberId = String(formData.get("member_id") ?? "");
    const email = String(formData.get("email") ?? "");

    await inviteMember(memberId, email);
  }

  return (
    <form action={action}>
      <input name="member_id" placeholder="Member UUID" required />
      <input name="email" type="email" placeholder="Email" required />
      <button type="submit">Send Invite</button>
    </form>
  );
}