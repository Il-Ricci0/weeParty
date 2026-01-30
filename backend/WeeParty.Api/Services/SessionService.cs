using System.Collections.Concurrent;
using WeeParty.Api.Models;

namespace WeeParty.Api.Services;

public class SessionService
{
    private readonly ConcurrentDictionary<string, Session> _sessions = new();
    private readonly ConcurrentDictionary<string, string> _codeToSessionId = new();
    private readonly Random _random = new();

    public Session CreateSession(string hostConnectionId, string gameId)
    {
        var session = new Session
        {
            Id = Guid.NewGuid().ToString("N")[..12],
            Code = GenerateCode(),
            HostConnectionId = hostConnectionId,
            GameId = gameId,
            State = SessionState.Lobby
        };

        _sessions[session.Id] = session;
        _codeToSessionId[session.Code] = session.Id;

        return session;
    }

    public Session? GetSession(string sessionId)
    {
        _sessions.TryGetValue(sessionId, out var session);
        return session;
    }

    public Session? GetSessionByCode(string code)
    {
        if (_codeToSessionId.TryGetValue(code.ToUpperInvariant(), out var sessionId))
        {
            return GetSession(sessionId);
        }
        return null;
    }

    public Player? AddPlayer(string sessionId, string connectionId, string playerName)
    {
        var session = GetSession(sessionId);
        if (session == null) return null;

        var player = new Player
        {
            Id = Guid.NewGuid().ToString("N")[..8],
            ConnectionId = connectionId,
            Name = playerName,
            PlayerIndex = session.Players.Count
        };

        session.Players.Add(player);
        return player;
    }

    public void RemovePlayer(string sessionId, string connectionId)
    {
        var session = GetSession(sessionId);
        if (session == null) return;

        var player = session.Players.FirstOrDefault(p => p.ConnectionId == connectionId);
        if (player != null)
        {
            session.Players.Remove(player);
        }
    }

    public Session? GetSessionByConnectionId(string connectionId)
    {
        return _sessions.Values.FirstOrDefault(s =>
            s.HostConnectionId == connectionId ||
            s.Players.Any(p => p.ConnectionId == connectionId));
    }

    public void RemoveSession(string sessionId)
    {
        if (_sessions.TryRemove(sessionId, out var session))
        {
            _codeToSessionId.TryRemove(session.Code, out _);
        }
    }

    private string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var code = new char[4];
        for (int i = 0; i < 4; i++)
        {
            code[i] = chars[_random.Next(chars.Length)];
        }
        return new string(code);
    }
}
