using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using WeeParty.Api.Models;
using WeeParty.Api.Services;

namespace WeeParty.Api.Hubs;

public class SignalingHub
{
    private readonly SessionService _sessionService;
    private readonly ConcurrentDictionary<string, WebSocket> _connections = new();
    private readonly ConcurrentDictionary<WebSocket, string> _connectionIds = new();
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public SignalingHub(SessionService sessionService)
    {
        _sessionService = sessionService;
    }

    public async Task HandleConnection(WebSocket webSocket)
    {
        var connectionId = Guid.NewGuid().ToString("N")[..12];
        _connections[connectionId] = webSocket;
        _connectionIds[webSocket] = connectionId;

        await SendMessage(webSocket, new { type = "connected", connectionId });

        var buffer = new byte[4096];
        try
        {
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(buffer, CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    break;
                }

                var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                await HandleMessage(webSocket, connectionId, message);
            }
        }
        finally
        {
            await HandleDisconnect(connectionId);
            _connections.TryRemove(connectionId, out _);
            _connectionIds.TryRemove(webSocket, out _);
        }
    }

    private async Task HandleMessage(WebSocket webSocket, string connectionId, string message)
    {
        try
        {
            using var doc = JsonDocument.Parse(message);
            var type = doc.RootElement.GetProperty("type").GetString();

            switch (type)
            {
                case "create-session":
                    await HandleCreateSession(webSocket, connectionId, doc.RootElement);
                    break;
                case "join-session":
                    await HandleJoinSession(webSocket, connectionId, doc.RootElement);
                    break;
                case "offer":
                case "answer":
                case "ice-candidate":
                    await HandleSignaling(connectionId, doc.RootElement);
                    break;
                case "start-game":
                    await HandleStartGame(connectionId);
                    break;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error handling message: {ex.Message}");
        }
    }

    private async Task HandleCreateSession(WebSocket webSocket, string connectionId, JsonElement element)
    {
        var gameId = element.TryGetProperty("gameId", out var g) ? g.GetString() ?? "pong" : "pong";
        var session = _sessionService.CreateSession(connectionId, gameId);

        await SendMessage(webSocket, new
        {
            type = "session-created",
            sessionId = session.Id,
            code = session.Code
        });
    }

    private async Task HandleJoinSession(WebSocket webSocket, string connectionId, JsonElement element)
    {
        var code = element.GetProperty("code").GetString()?.ToUpperInvariant() ?? "";
        var playerName = element.TryGetProperty("playerName", out var n) ? n.GetString() ?? "Player" : "Player";

        var session = _sessionService.GetSessionByCode(code);
        if (session == null)
        {
            await SendMessage(webSocket, new { type = "error", message = "Session not found" });
            return;
        }

        var player = _sessionService.AddPlayer(session.Id, connectionId, playerName);
        if (player == null)
        {
            await SendMessage(webSocket, new { type = "error", message = "Could not join session" });
            return;
        }

        // Notify the player they joined
        await SendMessage(webSocket, new
        {
            type = "session-joined",
            sessionId = session.Id,
            playerId = player.Id,
            playerIndex = player.PlayerIndex
        });

        // Notify the host about the new player
        if (_connections.TryGetValue(session.HostConnectionId, out var hostSocket))
        {
            await SendMessage(hostSocket, new
            {
                type = "player-joined",
                playerId = player.Id,
                playerName = player.Name,
                playerIndex = player.PlayerIndex,
                connectionId
            });
        }
    }

    private async Task HandleSignaling(string fromConnectionId, JsonElement element)
    {
        var targetId = element.GetProperty("targetId").GetString();
        if (string.IsNullOrEmpty(targetId)) return;

        if (_connections.TryGetValue(targetId, out var targetSocket))
        {
            var type = element.GetProperty("type").GetString();
            var messageObj = new Dictionary<string, object?>
            {
                ["type"] = type,
                ["fromId"] = fromConnectionId
            };

            if (element.TryGetProperty("sdp", out var sdp))
                messageObj["sdp"] = sdp.GetString();
            if (element.TryGetProperty("candidate", out var candidate))
                messageObj["candidate"] = candidate.GetString();
            if (element.TryGetProperty("sdpMid", out var sdpMid))
                messageObj["sdpMid"] = sdpMid.GetString();
            if (element.TryGetProperty("sdpMLineIndex", out var sdpMLineIndex))
                messageObj["sdpMLineIndex"] = sdpMLineIndex.GetInt32();

            await SendMessage(targetSocket, messageObj);
        }
    }

    private async Task HandleStartGame(string connectionId)
    {
        var session = _sessionService.GetSessionByConnectionId(connectionId);
        if (session == null || session.HostConnectionId != connectionId) return;

        session.State = SessionState.Playing;

        // Notify all players
        foreach (var player in session.Players)
        {
            if (_connections.TryGetValue(player.ConnectionId, out var playerSocket))
            {
                await SendMessage(playerSocket, new { type = "game-started" });
            }
        }
    }

    private async Task HandleDisconnect(string connectionId)
    {
        var session = _sessionService.GetSessionByConnectionId(connectionId);
        if (session == null) return;

        if (session.HostConnectionId == connectionId)
        {
            // Host disconnected - notify all players and end session
            foreach (var player in session.Players)
            {
                if (_connections.TryGetValue(player.ConnectionId, out var playerSocket))
                {
                    await SendMessage(playerSocket, new { type = "session-ended" });
                }
            }
            _sessionService.RemoveSession(session.Id);
        }
        else
        {
            // Player disconnected
            var player = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
            if (player != null)
            {
                _sessionService.RemovePlayer(session.Id, connectionId);

                // Notify host
                if (_connections.TryGetValue(session.HostConnectionId, out var hostSocket))
                {
                    await SendMessage(hostSocket, new
                    {
                        type = "player-left",
                        playerId = player.Id,
                        playerIndex = player.PlayerIndex
                    });
                }
            }
        }
    }

    private async Task SendMessage(WebSocket socket, object message)
    {
        if (socket.State != WebSocketState.Open) return;

        var json = JsonSerializer.Serialize(message, _jsonOptions);
        var bytes = Encoding.UTF8.GetBytes(json);
        await socket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
