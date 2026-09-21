import { z } from "zod";
const serviceSchema = z.object({ name: z.string().min(1).max(100), isCustom: z.boolean().default(false) });
const routeId = (request) => String(request.params.id);
export class ServiceController {
    service;
    constructor(service) {
        this.service = service;
    }
    list = async (_request, response) => response.json(await this.service.list());
    get = async (request, response) => response.json(await this.service.get(routeId(request)));
    create = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.status(201).json(await this.service.create(serviceSchema.parse(request.body), actorId));
    };
    update = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        response.json(await this.service.update(routeId(request), serviceSchema.partial().parse(request.body), actorId));
    };
    remove = async (request, response) => {
        const actorId = request.user?.sub;
        if (!actorId)
            return response.status(401).json({ message: "Não autenticado" });
        await this.service.remove(routeId(request), actorId);
        response.status(204).send();
    };
}
