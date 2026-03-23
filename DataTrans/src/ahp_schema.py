"""
ahp_schema.py - Extended AHP API schemas with OpenRouter analysis.
"""
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from schema import CanHoOut, CriterionWeight, RankedCanHo


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
    def validate_support_score(cls, value: float):
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
    def validate_status(cls, value: str):
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
