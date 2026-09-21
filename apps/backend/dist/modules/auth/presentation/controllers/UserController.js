import { z } from "zod";
const createSchema = z.object({ name: z.string().min(2).max(150), email: z.string().email(), password: z.string().min(8), roleId: z.string().uuid() });
const updateSchema = z.object({ name: z.string().min(2).max(150).optional(), email: z.string().email().optional(), password: z.string().min(8).optional() });
const routeId = (request) => String(request.params.id);
export class UserController {
    service;
    constructor(service) {
        this.service = service;
    }
    list = async (request, response) => {
        const status = request.query.status === "active" || request.query.status === "inactive" ? request.query.status : undefined;
        response.json(await this.service.list({ search: String(request.query.search || "") || undefined, role: String(request.query.role || "") || undefined, status }));
    };
    get = async (request, response) => response.json(await this.service.get(routeId(request)));
    create = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        const input = createSchema.parse(request.body);
        response.status(201).json(await this.service.create(input, actorId));
    };
    update = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.json(await this.service.update(routeId(request), updateSchema.parse(request.body), actorId));
    };
    setActive = (isActive) => async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.json(await this.service.setActive(routeId(request), isActive, actorId));
    };
    remove = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        await this.service.remove(routeId(request), actorId);
        response.status(204).send();
    };
}
