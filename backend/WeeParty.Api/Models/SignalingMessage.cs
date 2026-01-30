namespace WeeParty.Api.Models;

public class SignalingMessage
{
    public string Type { get; set; } = string.Empty;
    public string? Sdp { get; set; }
    public string? Candidate { get; set; }
    public string? SdpMid { get; set; }
    public int? SdpMLineIndex { get; set; }
    public string? TargetId { get; set; }
    public string? FromId { get; set; }
}

public class CreateSessionRequest
{
    public string GameId { get; set; } = "pong";
}

public class CreateSessionResponse
{
    public string SessionId { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class JoinSessionRequest
{
    public string Code { get; set; } = string.Empty;
    public string PlayerName { get; set; } = string.Empty;
}

public class JoinSessionResponse
{
    public string SessionId { get; set; } = string.Empty;
    public string PlayerId { get; set; } = string.Empty;
    public int PlayerIndex { get; set; }
}
