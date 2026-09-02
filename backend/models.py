from datetime import date
from enum import Enum

from pydantic import BaseModel, Field
from sqlalchemy import Date, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


class TransactionModel(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    description: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    amount: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    transaction_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    transaction_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )


class BudgetModel(Base):
    __tablename__ = "budgets"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
    )

    monthly_limit: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )


class TransactionCreate(BaseModel):
    description: str = Field(
        min_length=1,
        max_length=100,
    )

    amount: float = Field(gt=0)

    category: str = Field(
        min_length=1,
        max_length=50,
    )

    transaction_type: TransactionType

    transaction_date: date


class Transaction(TransactionCreate):
    id: int

    model_config = {
        "from_attributes": True,
    }


class BudgetCreate(BaseModel):
    category: str = Field(
        min_length=1,
        max_length=50,
    )

    monthly_limit: float = Field(gt=0)


class Budget(BudgetCreate):
    id: int

    model_config = {
        "from_attributes": True,
    }