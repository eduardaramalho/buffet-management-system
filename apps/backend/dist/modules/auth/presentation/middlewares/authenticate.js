import { tokenProvider } from "../../infrastructure/factories/auth.factory.js";
export const authenticate = (request, response, next) => {
    const header = request.header("authorization");
    if (!header?.startsWith("Bearer "))
        return response.status(401).json({ message: "Não autenticado" });
    try {
        request.user = tokenProvider.verifyAccessToken(header.slice(7));
        next();
    }
    catch {
        response.status(401).json({ message: "Token inválido" });
    }
};
