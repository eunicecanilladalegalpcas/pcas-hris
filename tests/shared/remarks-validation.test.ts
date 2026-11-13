import { describe, it, expect } from "vitest";
import { REMARKS_MAX_LENGTH, remarksSchema } from "@/shared/validation/shared";
import { hireEmployeeSchema, updateEmployeeProfileSchema } from "@/shared/validation/workforce";

const organizationId = "64b7f0f0f0f0f0f0f0f0f0f0";
const hire = { organizationId, firstName: "Jane", lastName: "Doe", employmentType: "regular" };
const edit = { organizationId, firstName: "Jane", lastName: "Doe" };
const tooLong = "x".repeat(REMARKS_MAX_LENGTH + 1);
const message = "Remarks can be at most 200 characters";

describe("remarksSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(remarksSchema.parse("  Senior, PWD  ")).toBe("Senior, PWD");
  });

  it("accepts exactly 200 characters", () => {
    expect(REMARKS_MAX_LENGTH).toBe(200);
    expect(remarksSchema.safeParse("x".repeat(200)).success).toBe(true);
  });

  it("rejects 201 characters with a message that names the limit", () => {
    const result = remarksSchema.safeParse(tooLong);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("remarks on the hire request", () => {
  it("keeps a trimmed note", () => {
    expect(hireEmployeeSchema.parse({ ...hire, remarks: " Senior " }).remarks).toBe("Senior");
  });

  it("treats a whitespace-only note as no note", () => {
    expect(hireEmployeeSchema.parse({ ...hire, remarks: "   " }).remarks).toBeUndefined();
  });

  it("is optional", () => {
    expect(hireEmployeeSchema.parse(hire).remarks).toBeUndefined();
  });

  it("rejects 201 characters on the remarks field", () => {
    const result = hireEmployeeSchema.safeParse({ ...hire, remarks: tooLong });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["remarks"]);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe("remarks on the edit request", () => {
  it("keeps an empty string, which is how the form clears the field", () => {
    expect(updateEmployeeProfileSchema.parse({ ...edit, remarks: "" }).remarks).toBe("");
  });

  it("keeps a trimmed note", () => {
    expect(updateEmployeeProfileSchema.parse({ ...edit, remarks: " PWD " }).remarks).toBe("PWD");
  });

  it("rejects 201 characters on the remarks field", () => {
    const result = updateEmployeeProfileSchema.safeParse({ ...edit, remarks: tooLong });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["remarks"]);
    expect(result.error?.issues[0].message).toBe(message);
  });
});
