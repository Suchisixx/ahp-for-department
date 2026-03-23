"""
AHP and compare API schemas.
"""
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from schema import CriterionWeight, RankedCanHo


class AhpRequest(BaseModel):
    ten_phien: str = "Phiên AHP"
    matrix: list[list[float]]
    llm_model: Optional[str] = None
    llm_enabled: bool = True

    @field_validator("matrix")
    @classmethod
    def validate_matrix(cls, value: list[list[float]]):
        if len(value) != 8:
            raise ValueError("Ma trận phải là 8x8")

        for row in value:
            if len(row) != 8:
                raise ValueError("Mỗi hàng phải có 8 phần tử")
            for cell in row:
                if cell <= 0:
                    raise ValueError("Tất cả giá trị phải > 0")

        return value

    @field_validator("llm_model")
    @classmethod
    def validate_ahp_llm_model(cls, value: Optional[str]):
        if value is None:
            return None

        model = value.strip()
        return model or None


class CompareRequest(BaseModel):
    session_id: int
    canho_ids: list[int]
    llm_model: Optional[str] = None

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, value: int):
        if value <= 0:
            raise ValueError("session_id phải > 0")
        return value

    @field_validator("canho_ids")
    @classmethod
    def validate_canho_ids(cls, value: list[int]):
        if len(value) < 2 or len(value) > 4:
            raise ValueError("Chỉ được so sánh từ 2 đến 4 căn hộ")
        if len(set(value)) != len(value):
            raise ValueError("Danh sách căn hộ so sánh không được trùng nhau")
        if any(item <= 0 for item in value):
            raise ValueError("canho_ids phải là số nguyên dương")
        return value

    @field_validator("llm_model")
    @classmethod
    def validate_llm_model(cls, value: Optional[str]):
        if value is None:
            return None

        model = value.strip()
        return model or None


class CriterionScoreBreakdown(BaseModel):
    C1: float
    C2: float
    C3: float
    C4: float
    C5: float
    C6: float
    C7: float
    C8: float

    @field_validator("*")
    @classmethod
    def validate_score_range(cls, value: float):
        if value < 0 or value > 100:
            raise ValueError("Criterion score must be between 0 and 100")
        return round(float(value), 2)


class CompareApartmentAnalysisItem(BaseModel):
    canho_id: int
    llm_support_score: float
    verdict: str
    strengths: list[str]
    risks: list[str]
    criterion_scores: CriterionScoreBreakdown

    @field_validator("llm_support_score")
    @classmethod
    def validate_support_score(cls, value: float):
        if value < 0 or value > 100:
            raise ValueError("Support score must be between 0 and 100")
        return round(float(value), 2)


class CompareResponse(BaseModel):
    status: str
    model: Optional[str] = None
    session_id: int
    compared_ids: list[int] = Field(default_factory=list)
    summary: Optional[str] = None
    winner_id: Optional[int] = None
    winner_reason: Optional[str] = None
    tradeoffs: list[str] = Field(default_factory=list)
    apartments: list[CompareApartmentAnalysisItem] = Field(default_factory=list)
    error: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str):
        if value not in {"success", "failed"}:
            raise ValueError("Invalid compare status")
        return value


class ApartmentChatMessage(BaseModel):
    role: str
    content: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str):
        role = value.strip().lower()
        if role not in {"user", "assistant"}:
            raise ValueError("Invalid chat role")
        return role

    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str):
        text = value.strip()
        if not text:
            raise ValueError("Chat content cannot be empty")
        return text[:1000]


class ApartmentChatRequest(BaseModel):
    session_id: int
    canho_id: int
    question: str
    llm_model: Optional[str] = None
    history: list[ApartmentChatMessage] = Field(default_factory=list)

    @field_validator("session_id", "canho_id")
    @classmethod
    def validate_positive_id(cls, value: int):
        if value <= 0:
            raise ValueError("Identifiers must be > 0")
        return value

    @field_validator("question")
    @classmethod
    def validate_question(cls, value: str):
        text = value.strip()
        if not text:
            raise ValueError("question cannot be empty")
        return text[:1000]

    @field_validator("llm_model")
    @classmethod
    def validate_chat_llm_model(cls, value: Optional[str]):
        if value is None:
            return None

        model = value.strip()
        return model or None

    @field_validator("history")
    @classmethod
    def validate_history(cls, value: list[ApartmentChatMessage]):
        return value[-6:]


class ApartmentChatResponse(BaseModel):
    status: str
    model: Optional[str] = None
    session_id: int
    canho_id: int
    answer: Optional[str] = None
    suggested_questions: list[str] = Field(default_factory=list)
    refusal_reason: Optional[str] = None
    error: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_chat_status(cls, value: str):
        if value not in {"success", "failed", "refused"}:
            raise ValueError("Invalid apartment chat status")
        return value


class AhpIntakeRequest(BaseModel):
    user_input: str
    llm_model: Optional[str] = None

    @field_validator("user_input")
    @classmethod
    def validate_user_input(cls, value: str):
        text = value.strip()
        if not text:
            raise ValueError("user_input cannot be empty")
        return text[:2000]

    @field_validator("llm_model")
    @classmethod
    def validate_intake_llm_model(cls, value: Optional[str]):
        if value is None:
            return None

        model = value.strip()
        return model or None


class AhpIntentProfile(BaseModel):
    goal: str
    budget: Optional[str] = None
    preferred_area: Optional[str] = None
    bedroom_need: Optional[str] = None
    top_priorities: list[str] = Field(default_factory=list)
    deal_breakers: list[str] = Field(default_factory=list)

    @field_validator("goal")
    @classmethod
    def validate_goal(cls, value: str):
        text = value.strip()
        return text or "Đang tìm căn hộ phù hợp để ở."

    @field_validator("budget", "preferred_area", "bedroom_need")
    @classmethod
    def validate_optional_text(cls, value: Optional[str]):
        if value is None:
            return None

        text = value.strip()
        return text or None

    @field_validator("top_priorities", "deal_breakers")
    @classmethod
    def validate_string_list(cls, value: list[str]):
        normalized = []
        for item in value:
            text = str(item).strip()
            if text:
                normalized.append(text[:120])
        return normalized[:4]


class AhpIntakeResponse(BaseModel):
    status: str
    model: Optional[str] = None
    intent_profile: Optional[AhpIntentProfile] = None
    recommended_preset: str = "balanced"
    suggested_weights: list[CriterionWeight] = Field(default_factory=list)
    explanation: Optional[str] = None
    error: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_intake_status(cls, value: str):
        if value not in {"success", "failed"}:
            raise ValueError("Invalid intake status")
        return value

    @field_validator("recommended_preset")
    @classmethod
    def validate_recommended_preset(cls, value: str):
        preset = value.strip().lower()
        if preset not in {"balanced", "price", "quality", "legal", "location"}:
            return "balanced"
        return preset

    @field_validator("explanation")
    @classmethod
    def validate_explanation(cls, value: Optional[str]):
        if value is None:
            return None

        text = value.strip()
        return text or None


class LlmApartmentAnalysisItem(BaseModel):
    rank: int
    canho_id: int
    llm_support_score: float
    verdict: str
    strengths: list[str]
    risks: list[str]
    criterion_scores: CriterionScoreBreakdown

    @field_validator("llm_support_score")
    @classmethod
    def validate_ranked_support_score(cls, value: float):
        if value < 0 or value > 100:
            raise ValueError("Support score must be between 0 and 100")
        return round(float(value), 2)


class LlmAnalysis(BaseModel):
    status: str
    model: Optional[str] = None
    top_k: int = 0
    summary: Optional[str] = None
    winner_reason: Optional[str] = None
    tradeoffs: list[str] = Field(default_factory=list)
    error: Optional[str] = None
    apartments: list[LlmApartmentAnalysisItem] = Field(default_factory=list)

    @field_validator("status")
    @classmethod
    def validate_llm_status(cls, value: str):
        if value not in {"success", "failed", "skipped"}:
            raise ValueError("Invalid LLM analysis status")
        return value


class AhpResponse(BaseModel):
    session_id: int
    ten_phien: str
    cr: float
    ci: float
    lambda_max: float
    cr_ok: bool
    criteria_matrix: list[list[float]]
    weights: list[CriterionWeight]
    total_canho: int
    ranked: list[RankedCanHo]
    llm_analysis: LlmAnalysis
