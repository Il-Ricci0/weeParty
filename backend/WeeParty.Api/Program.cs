using WeeParty.Api.Hubs;
using WeeParty.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddSingleton<SessionService>();
builder.Services.AddSingleton<SignalingHub>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure CORS for local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");
app.UseWebSockets();

// WebSocket endpoint for signaling
app.Map("/ws", async context =>
{
    if (context.WebSockets.IsWebSocketRequest)
    {
        var hub = context.RequestServices.GetRequiredService<SignalingHub>();
        using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
        await hub.HandleConnection(webSocket);
    }
    else
    {
        context.Response.StatusCode = 400;
    }
});

// REST endpoints for session info
var sessionService = app.Services.GetRequiredService<SessionService>();

app.MapGet("/api/sessions/{code}", (string code) =>
{
    var session = sessionService.GetSessionByCode(code);
    if (session == null)
        return Results.NotFound();

    return Results.Ok(new
    {
        session.Id,
        session.Code,
        session.GameId,
        session.State,
        PlayerCount = session.Players.Count
    });
})
.WithName("GetSession")
.WithOpenApi();

app.MapGet("/api/health", () => Results.Ok(new { status = "healthy" }))
.WithName("Health")
.WithOpenApi();

Console.WriteLine("WeeParty API starting on http://localhost:5000");
app.Run("http://localhost:5000");

