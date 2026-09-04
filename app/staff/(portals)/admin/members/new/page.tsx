import { createMember } from "../actions";

export default function NewMemberPage() {
  return (
    <main>
      <h1>Create Member</h1>

      <form action={createMember}>
        <div>
          <label htmlFor="first_name">First name</label>
          <input id="first_name" name="first_name" required />
        </div>

        <div>
          <label htmlFor="last_name">Last name</label>
          <input id="last_name" name="last_name" required />
        </div>

        <button type="submit">Create Member</button>
      </form>
    </main>
  );
}