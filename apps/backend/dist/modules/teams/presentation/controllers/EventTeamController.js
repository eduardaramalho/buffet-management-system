const actorId = (request) => request.user?.sub;
export class EventTeamController {
    service;
    constructor(service) {
        this.service = service;
    }
    assignTeamToEvent = async (request, response) => {
        const userId = actorId(request);
        if (!userId)
            return response.status(401).json({ message: "Não autenticado" });
        const assignment = await this.service.assignTeamToEvent(String(request.params.eventId), String(request.params.teamId), userId);
        response.status(201).json(assignment);
    };
    unassignTeamFromEvent = async (request, response) => {
        const userId = actorId(request);
        if (!userId)
            return response.status(401).json({ message: "Não autenticado" });
        await this.service.unassignTeamFromEvent(String(request.params.eventId), String(request.params.teamId), userId);
        response.status(204).send();
    };
    listTeamsByEvent = async (request, response) => response.json(await this.service.listTeamsByEvent(String(request.params.eventId)));
    listEventsByTeam = async (request, response) => response.json(await this.service.listEventsByTeam(String(request.params.teamId)));
}
