from datetime import date
from enum import Enum

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import (
    Boolean,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class TransactionType(str, Enum):
    income = "income"
    expense = "expense"


class RecurringFrequency(str, Enum):
    weekly = "weekly"
    biweekly = "biweekly"
    monthly = "monthly"
    yearly = "yearly"


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    transactions: Mapped[list["TransactionModel"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    budgets: Mapped[list["BudgetModel"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    recurring_transactions: Mapped[list["RecurringTransactionModel"]] = (
        relationship(back_populates="user", cascade="all, delete-orphan")
    )
    savings_goals: Mapped[list["SavingsGoalModel"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class TransactionModel(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)

    user: Mapped["UserModel"] = relationship(back_populates="transactions")


class BudgetModel(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "category", name="uq_budget_user_category"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    monthly_limit: Mapped[float] = mapped_column(Float, nullable=False)

    user: Mapped["UserModel"] = relationship(back_populates="budgets")


class RecurringTransactionModel(Base):
    __tablename__ = "recurring_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    user: Mapped["UserModel"] = relationship(
        back_populates="recurring_transactions"
    )


class SavingsGoalModel(Base):
    __tablename__ = "savings_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    target_amount: Mapped[float] = mapped_column(Float, nullable=False)
    current_amount: Mapped[float] = mapped_column(
        Float, nullable=False, default=0
    )
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    user: Mapped["UserModel"] = relationship(back_populates="savings_goals")


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class User(BaseModel):
    id: int
    name: str
    email: EmailStr
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: User


class TransactionCreate(BaseModel):
    description: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    category: str = Field(min_length=1, max_length=50)
    transaction_type: TransactionType
    transaction_date: date


class Transaction(TransactionCreate):
    id: int
    model_config = {"from_attributes": True}


class BudgetCreate(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    monthly_limit: float = Field(gt=0)


class Budget(BudgetCreate):
    id: int
    model_config = {"from_attributes": True}


class RecurringTransactionCreate(BaseModel):
    description: str = Field(min_length=1, max_length=100)
    amount: float = Field(gt=0)
    category: str = Field(min_length=1, max_length=50)
    transaction_type: TransactionType
    frequency: RecurringFrequency
    next_due_date: date
    is_active: bool = True


class RecurringTransaction(RecurringTransactionCreate):
    id: int
    model_config = {"from_attributes": True}


class SavingsGoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    target_amount: float = Field(gt=0)
    current_amount: float = Field(ge=0, default=0)
    target_date: date | None = None


class SavingsGoal(SavingsGoalCreate):
    id: int
    model_config = {"from_attributes": True}


class SavingsContribution(BaseModel):
    amount: float = Field(gt=0)