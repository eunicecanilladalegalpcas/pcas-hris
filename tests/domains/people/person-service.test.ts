import { describe, it, expect, beforeEach } from "vitest";
import { connectMongoDB } from "@/server/db/connection";
import { OrganizationModel, PersonModel } from "@/server/db/models";
import { PersonService } from "@/domains/people/person-service";
import { NotFoundError } from "@/shared/errors";

describe("PersonService", () => {
  beforeEach(async () => {
    await connectMongoDB();
    await Promise.all([OrganizationModel.deleteMany({}), PersonModel.deleteMany({})]);
  });

  it("creates a person scoped to the organization", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-1" });

    const person = await PersonService.create(
      { organizationId: organization._id.toString(), firstName: "Jane", lastName: "Doe" },
      {},
    );

    expect(person.firstName).toBe("Jane");
    const found = await PersonModel.findById(person._id).lean();
    expect(found?.organizationId.toString()).toBe(organization._id.toString());
  });

  it("updates a person's editable fields", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-2" });
    const person = await PersonService.create(
      { organizationId: organization._id.toString(), firstName: "Jane", lastName: "Doe" },
      {},
    );

    const updated = await PersonService.update(
      person._id.toString(),
      organization._id.toString(),
      { firstName: "Janet", phone: "09171234567", sssNumber: "34-1234567-8" },
      {},
    );

    expect(updated.firstName).toBe("Janet");
    expect(updated.phone).toBe("09171234567");
    expect(updated.sssNumber).toBe("34-1234567-8");
    expect(updated.lastName).toBe("Doe");
  });

  it("clears an optional field when patched with an empty string, without touching untouched fields", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-4" });
    const person = await PersonService.create(
      { organizationId: organization._id.toString(), firstName: "Jane", lastName: "Doe", phone: "09171234567", email: "jane@acme.test" },
      {},
    );

    const updated = await PersonService.update(person._id.toString(), organization._id.toString(), { phone: "" }, {});

    expect(updated.phone).toBeUndefined();
    expect(updated.email).toBe("jane@acme.test");
  });

  it("stores remarks on create and replaces them on update", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-5" });
    const person = await PersonService.create(
      { organizationId: organization._id.toString(), firstName: "Jane", lastName: "Doe", remarks: "Senior" },
      {},
    );
    expect(person.remarks).toBe("Senior");

    const updated = await PersonService.update(person._id.toString(), organization._id.toString(), { remarks: "Senior, PWD" }, {});
    expect(updated.remarks).toBe("Senior, PWD");
  });

  it("removes remarks when patched with an empty string", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-6" });
    const person = await PersonService.create(
      { organizationId: organization._id.toString(), firstName: "Jane", lastName: "Doe", remarks: "Senior" },
      {},
    );

    await PersonService.update(person._id.toString(), organization._id.toString(), { remarks: "" }, {});

    const found = await PersonModel.findById(person._id).lean();
    expect(found?.remarks).toBeUndefined();
    expect(found && "remarks" in found).toBe(false);
  });

  it("rejects remarks longer than 200 characters at the model, whatever the caller validated", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-7" });

    await expect(
      PersonService.create({ organizationId: organization._id.toString(), firstName: "Jane", lastName: "Doe", remarks: "x".repeat(201) }, {}),
    ).rejects.toThrow(/remarks/i);
  });

  it("rejects updating a person outside the organization", async () => {
    const organization = await OrganizationModel.create({ name: "Acme", slug: "acme-person-3" });
    const otherOrganization = await OrganizationModel.create({ name: "Other", slug: "other-person-3" });
    const foreignPerson = await PersonService.create(
      { organizationId: otherOrganization._id.toString(), firstName: "Foreign", lastName: "Person" },
      {},
    );

    await expect(
      PersonService.update(foreignPerson._id.toString(), organization._id.toString(), { firstName: "X" }, {}),
    ).rejects.toThrow(NotFoundError);
  });
});
