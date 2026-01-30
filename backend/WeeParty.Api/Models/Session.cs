namespace WeeParty.Api.Models;

public class Session
{
    public string Id { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string HostConnectionId { get; set; } = string.Empty;
    public string GameId { get; set; } = string.Empty;
    public List<Player> Players { get; set; } = new();
    public SessionState State { get; set; } = SessionState.Lobby;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Player
{
    public string Id { get; set; } = string.Empty;
    public string ConnectionId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int PlayerIndex { get; set; }
}

public enum SessionState
{
    Lobby,
    Playing,
    Ended
}
