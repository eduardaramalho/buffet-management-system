import { z } from "zod";
const collaboratorSchema = z.object({
    name: z.string().min(1).max(150),
    phone: z.string().max(30).nullable().optional().default(null),
    position: z.string().min(1).max(100),
});
const statusSchema = z.object({ active: z.boolean() });
const listSchema = z.object({ search: z.string().optional() });
const routeId = (request) => String(request.params.id);
export class CollaboratorController {
    service;
    constructor(service) {
        this.service = service;
    }
    list = async (request, response) => response.json(await this.service.list(listSchema.parse(request.query)));
    get = async (request, response) => response.json(await this.service.get(routeId(request)));
    create = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.status(201).json(await this.service.create(collaboratorSchema.parse(request.body), actorId));
    };
    update = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.json(await this.service.update(routeId(request), collaboratorSchema.partial().parse(request.body), actorId));
    };
    setStatus = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.json(await this.service.setActive(routeId(request), statusSchema.parse(request.body).active, actorId));
    };
}
