// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HireForm } from "@/app/(app)/people/new/hire-form";
import { EditEmployeeDialog } from "@/app/(app)/people/[id]/edit-employee-dialog";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  // jsdom has no scrollIntoView; a field error scrolls its control into view.
  Element.prototype.scrollIntoView = vi.fn();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);
const tooLong = "x".repeat(201);

describe("Remarks on the hire form", () => {
  const props = { organizationId: "org1", positions: [], projects: [], employmentTypes: [{ id: "regular", label: "Regular", requiresEndOfContract: false }] };

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/First name/), "Jane");
    await user.type(screen.getByLabelText(/Last name/), "Doe");
    await user.click(screen.getByLabelText(/Employment type/));
    await user.click(await screen.findByRole("option", { name: "Regular" }));
  }

  it("counts the characters typed against the limit", async () => {
    const user = userEvent.setup();
    render(<HireForm {...props} />);

    expect(screen.getByText("Optional. 0/200")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Remarks/), "Senior");
    expect(screen.getByText("Optional. 6/200")).toBeInTheDocument();
  });

  it("stops a note over 200 characters before it is sent", async () => {
    const user = userEvent.setup();
    render(<HireForm {...props} />);

    await fillRequired(user);
    fireEvent.change(screen.getByLabelText(/Remarks/), { target: { value: tooLong } });
    await user.click(screen.getByRole("button", { name: /Add employee/ }));

    expect(await screen.findByText("Remarks can be at most 200 characters")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the trimmed note with the new employee", async () => {
    const user = userEvent.setup();
    render(<HireForm {...props} />);

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Remarks/), "  Senior, PWD ");
    await user.click(screen.getByRole("button", { name: /Add employee/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/people"));
    expect(sentBody().remarks).toBe("Senior, PWD");
  });

  it("sends no remarks when the note is left blank", async () => {
    const user = userEvent.setup();
    render(<HireForm {...props} />);

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Remarks/), "   ");
    await user.click(screen.getByRole("button", { name: /Add employee/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect("remarks" in sentBody()).toBe(false);
  });
});

describe("Remarks on the edit employee dialog", () => {
  const props = { organizationId: "org1", employeeId: "e1", initialValue: { firstName: "Jane", lastName: "Doe", remarks: "Senior" } };

  it("starts from the saved note and sends the change", async () => {
    const user = userEvent.setup();
    render(<EditEmployeeDialog {...props} />);

    await user.click(screen.getByTestId("edit-employee-button"));
    const remarks = screen.getByLabelText(/Remarks/);
    expect(remarks).toHaveValue("Senior");
    await user.type(remarks, ", PWD");
    await user.click(screen.getByTestId("edit-employee-submit-button"));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(sentBody().remarks).toBe("Senior, PWD");
  });

  it("sends an empty string when the note is cleared, so the API removes it", async () => {
    const user = userEvent.setup();
    render(<EditEmployeeDialog {...props} />);

    await user.click(screen.getByTestId("edit-employee-button"));
    await user.clear(screen.getByLabelText(/Remarks/));
    await user.click(screen.getByTestId("edit-employee-submit-button"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(sentBody().remarks).toBe("");
  });

  it("stops a note over 200 characters before it is sent", async () => {
    const user = userEvent.setup();
    render(<EditEmployeeDialog {...props} />);

    await user.click(screen.getByTestId("edit-employee-button"));
    fireEvent.change(screen.getByLabelText(/Remarks/), { target: { value: tooLong } });
    await user.click(screen.getByTestId("edit-employee-submit-button"));

    expect(await screen.findByText("Remarks can be at most 200 characters")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
