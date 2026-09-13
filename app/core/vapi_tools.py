"""
Vapi Custom/Function Tools always POST in this payload format:

{
  "message": {
    "toolCalls": [
      { "id": "call_abc", "function": { "name": "...", "arguments": {...} } }
    ]
  }
}

And expect a response formatted as:

{
  "results": [
    { "toolCallId": "call_abc", "result": "..." }
  ]
}

These helpers handle the parsing and formatting.
"""
import json
from fastapi import Request


async def extract_tool_call(request: Request) -> tuple[str, dict]:
    """
    Extracts (toolCallId, arguments) from the incoming request.
    Handles all Vapi payload formats (toolCalls, toolWithToolCallList, functionCall, direct JSON).
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    # 1. Standard Vapi toolCalls inside message or root
    tool_calls = body.get("message", {}).get("toolCalls") or body.get("toolCalls")
    if tool_calls and isinstance(tool_calls, list) and len(tool_calls) > 0:
        call = tool_calls[0]
        tool_call_id = call.get("id", "")
        arguments = call.get("function", {}).get("arguments", {})
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except Exception:
                pass
        return tool_call_id, arguments if isinstance(arguments, dict) else {}

    # 2. Vapi toolWithToolCallList
    tool_list = body.get("message", {}).get("toolWithToolCallList") or body.get("toolWithToolCallList")
    if tool_list and isinstance(tool_list, list) and len(tool_list) > 0:
        call = tool_list[0]
        tool_call_id = call.get("id", "") or call.get("toolCall", {}).get("id", "")
        arguments = call.get("function", {}).get("arguments", {}) or call.get("toolCall", {}).get("function", {}).get("arguments", {})
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except Exception:
                pass
        return tool_call_id, arguments if isinstance(arguments, dict) else {}

    # 3. Legacy functionCall
    function_call = body.get("message", {}).get("functionCall") or body.get("functionCall")
    if function_call and isinstance(function_call, dict):
        tool_call_id = function_call.get("id", "func-call")
        arguments = function_call.get("parameters") or function_call.get("arguments") or {}
        if isinstance(arguments, str):
            try:
                arguments = json.loads(arguments)
            except Exception:
                pass
        return tool_call_id, arguments if isinstance(arguments, dict) else {}

    # 4. Fallback for direct testing
    params = body.get("parameters") or body.get("arguments") or body
    return "test-call", params if isinstance(params, dict) else {}


def format_tool_result(tool_call_id: str, result: str) -> dict:
    return {
        "results": [{"toolCallId": tool_call_id, "result": result}],
        "result": result,
    }

