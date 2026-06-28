import re

from sympy import sympify, SympifyError

from ..utils.errors import ValidationError


def handle_calculate(expression: str) -> str:
    if not isinstance(expression, str):
        raise ValidationError("Expression must be a string")
    if len(expression) > 500:
        raise ValidationError("Expression too long (max 500 chars)")
    if not re.match(r"^[0-9+\-*/().\s^%]+$", expression):
        raise ValidationError("Expression contains invalid characters")

    try:
        result = sympify(expression.strip())
        return f"Result: {result}"
    except SympifyError as exc:
        raise ValidationError(f"Invalid expression: {exc}") from exc
