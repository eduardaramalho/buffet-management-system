import { describe, expect, it, jest } from "@jest/globals";

import { ClientService } from "./ClientService.js";
import { ClientConflictError, ClientManagementError } from "../domain/client.errors.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { ClientAuditService, ClientRecord, ClientRepository, CreateClientInput } from "../domain/client.types.js";

const VALID_CPF = "52998224725";
const VALID_CNPJ = "11222333000181";

const makeClient = (overrides: Partial<ClientRecord> = {}): ClientRecord => ({
  id: "client-1",
  type: "PF",
  name: "Ana Souza",
  document: VALID_CPF,
  email: "ana@email.com",
  phone: "47999990000",
  notes: null,
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  deletedAt: null,
  ...overrides,
});

const baseInput = (overrides: Partial<CreateClientInput> = {}): CreateClientInput => ({
  type: "PF",
  name: "Ana Souza",
  document: null,
  email: null,
  phone: null,
  notes: null,
  ...overrides,
});

const makeRepository = (overrides: Partial<Record<keyof ClientRepository, unknown>> = {}) => ({
  findById: jest.fn(async () => makeClient()),
  findByDocument: jest.fn(async () => null),
  list: jest.fn(async () => [makeClient()]),
  create: jest.fn(async (input: CreateClientInput) => makeClient({ ...input })),
  update: jest.fn(async (_id: string, input: Partial<CreateClientInput>) => makeClient({ ...input })),
  softDelete: jest.fn(async () => makeClient({ deletedAt: new Date() })),
  countOpenEvents: jest.fn(async () => 0),
  ...overrides,
}) as unknown as ClientRepository;

const makeAudit = () => ({ record: jest.fn(async () => undefined) }) as unknown as ClientAuditService;

describe("ClientService", () => {
  describe("list and get", () => {
    it("lists clients with the given filter and an empty default filter", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await service.list({ search: "Ana" });
      await service.list();

      expect(clients.list).toHaveBeenNthCalledWith(1, { search: "Ana" });
      expect(clients.list).toHaveBeenNthCalledWith(2, {});
    });

    it("gets a client and throws NotFoundError for a missing one", async () => {
      const client = makeClient();
      const service = new ClientService(makeRepository({ findById: jest.fn(async (id: string) => (id === "client-1" ? client : null)) }), makeAudit());

      await expect(service.get("client-1")).resolves.toEqual(client);
      await expect(service.get("missing")).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("create", () => {
    it("trims and normalizes the input, stores the document without punctuation and audits without personal data", async () => {
      const clients = makeRepository();
      const audit = makeAudit();
      const service = new ClientService(clients, audit);

      await service.create(baseInput({ name: "  Ana Souza ", document: "529.982.247-25", email: " Ana@Email.com ", phone: " 47 99999-0000 ", notes: "  " }), "actor-1");

      expect(clients.create).toHaveBeenCalledWith({
        type: "PF",
        name: "Ana Souza",
        document: VALID_CPF,
        email: "ana@email.com",
        phone: "47 99999-0000",
        notes: null,
      });
      expect(audit.record).toHaveBeenCalledWith({
        userId: "actor-1",
        action: "CLIENT_CREATED",
        entity: "Client",
        entityId: "client-1",
        changes: { name: "Ana Souza", type: "PF" },
      });
    });

    it("creates a client without a document", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await service.create(baseInput({ document: "  " }), "actor-1");

      expect(clients.findByDocument).not.toHaveBeenCalled();
      expect(clients.create).toHaveBeenCalledWith(expect.objectContaining({ document: null }));
    });

    it("rejects an empty name", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await expect(service.create(baseInput({ name: "   " }), "actor-1")).rejects.toThrow(new ClientManagementError("O nome do cliente é obrigatório"));
      expect(clients.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid CPF for PF and an invalid CNPJ for PJ", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await expect(service.create(baseInput({ type: "PF", document: "529.982.247-24" }), "actor-1")).rejects.toThrow(new ClientManagementError("CPF inválido"));
      await expect(service.create(baseInput({ type: "PJ", document: VALID_CPF }), "actor-1")).rejects.toThrow(new ClientManagementError("CNPJ inválido"));
      expect(clients.create).not.toHaveBeenCalled();
    });

    it("accepts an alphanumeric CNPJ for PJ", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await service.create(baseInput({ type: "PJ", name: "Buffet Ltda", document: "12.ABC.345/01DE-35" }), "actor-1");

      expect(clients.create).toHaveBeenCalledWith(expect.objectContaining({ type: "PJ", document: "12ABC34501DE35" }));
    });

    it("rejects a document already used by an active client with a conflict", async () => {
      const clients = makeRepository({ findByDocument: jest.fn(async () => makeClient({ id: "client-2" })) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.create(baseInput({ document: VALID_CPF }), "actor-1")).rejects.toThrow(new ClientConflictError("Já existe um cliente com este documento"));
      expect(clients.create).not.toHaveBeenCalled();
    });

    it("explains when the document belongs to a deleted client", async () => {
      const clients = makeRepository({ findByDocument: jest.fn(async () => makeClient({ id: "client-2", deletedAt: new Date() })) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.create(baseInput({ document: VALID_CPF }), "actor-1")).rejects.toThrow(new ClientConflictError("Este documento pertence a um cliente excluído"));
    });
  });

  describe("update", () => {
    it("updates only the given fields and audits the changed field names", async () => {
      const clients = makeRepository();
      const audit = makeAudit();
      const service = new ClientService(clients, audit);

      await service.update("client-1", { name: " Ana Lima ", phone: "" }, "actor-1");

      expect(clients.update).toHaveBeenCalledWith("client-1", { name: "Ana Lima", phone: null });
      expect(audit.record).toHaveBeenCalledWith({
        userId: "actor-1",
        action: "CLIENT_UPDATED",
        entity: "Client",
        entityId: "client-1",
        changes: { name: "Ana Lima", fields: ["name", "phone"] },
      });
    });

    it("throws NotFoundError when updating a missing client", async () => {
      const clients = makeRepository({ findById: jest.fn(async () => null) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.update("missing", { name: "Ana" }, "actor-1")).rejects.toBeInstanceOf(NotFoundError);
      expect(clients.update).not.toHaveBeenCalled();
    });

    it("rejects updating to an empty name", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await expect(service.update("client-1", { name: " " }, "actor-1")).rejects.toThrow("O nome do cliente é obrigatório");
      expect(clients.update).not.toHaveBeenCalled();
    });

    it("revalidates the current document when only the type changes", async () => {
      const clients = makeRepository({ findById: jest.fn(async () => makeClient({ document: VALID_CPF })) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.update("client-1", { type: "PJ" }, "actor-1")).rejects.toThrow("CNPJ inválido");
      expect(clients.update).not.toHaveBeenCalled();
    });

    it("changes type and document together", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await service.update("client-1", { type: "PJ", document: "11.222.333/0001-81" }, "actor-1");

      expect(clients.update).toHaveBeenCalledWith("client-1", { type: "PJ", document: VALID_CNPJ });
    });

    it("allows keeping the same document and clearing it", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await service.update("client-1", { document: "529.982.247-25" }, "actor-1");
      await service.update("client-1", { document: null }, "actor-1");

      expect(clients.findByDocument).not.toHaveBeenCalled();
      expect(clients.update).toHaveBeenNthCalledWith(1, "client-1", { document: VALID_CPF });
      expect(clients.update).toHaveBeenNthCalledWith(2, "client-1", { document: null });
    });

    it("rejects a document used by another client", async () => {
      const clients = makeRepository({
        findById: jest.fn(async () => makeClient({ document: null })),
        findByDocument: jest.fn(async () => makeClient({ id: "client-2" })),
      });
      const service = new ClientService(clients, makeAudit());

      await expect(service.update("client-1", { document: VALID_CPF }, "actor-1")).rejects.toBeInstanceOf(ClientConflictError);
      expect(clients.update).not.toHaveBeenCalled();
    });

    it("normalizes email, phone and notes when they are sent", async () => {
      const clients = makeRepository();
      const service = new ClientService(clients, makeAudit());

      await service.update("client-1", { email: " NOVO@Email.com ", notes: " Prefere contato por e-mail " }, "actor-1");

      expect(clients.update).toHaveBeenCalledWith("client-1", { email: "novo@email.com", notes: "Prefere contato por e-mail" });
    });
  });

  describe("remove", () => {
    it("soft deletes a client without open events and audits it", async () => {
      const clients = makeRepository();
      const audit = makeAudit();
      const service = new ClientService(clients, audit);

      await service.remove("client-1", "actor-1");

      expect(clients.countOpenEvents).toHaveBeenCalledWith("client-1");
      expect(clients.softDelete).toHaveBeenCalledWith("client-1");
      expect(audit.record).toHaveBeenCalledWith({
        userId: "actor-1",
        action: "CLIENT_DELETED",
        entity: "Client",
        entityId: "client-1",
        changes: { name: "Ana Souza" },
      });
    });

    it("blocks removal with a conflict while the client has open events", async () => {
      const clients = makeRepository({ countOpenEvents: jest.fn(async () => 2) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.remove("client-1", "actor-1")).rejects.toThrow(new ClientConflictError("O cliente possui 2 eventos em aberto e não pode ser excluído"));
      expect(clients.softDelete).not.toHaveBeenCalled();
    });

    it("uses the singular form for a single open event", async () => {
      const clients = makeRepository({ countOpenEvents: jest.fn(async () => 1) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.remove("client-1", "actor-1")).rejects.toThrow("O cliente possui 1 evento em aberto e não pode ser excluído");
    });

    it("throws NotFoundError when removing a missing client", async () => {
      const clients = makeRepository({ findById: jest.fn(async () => null) });
      const service = new ClientService(clients, makeAudit());

      await expect(service.remove("missing", "actor-1")).rejects.toBeInstanceOf(NotFoundError);
      expect(clients.softDelete).not.toHaveBeenCalled();
    });
  });
});
