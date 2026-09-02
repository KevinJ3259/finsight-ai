import os

from dotenv import load_dotenv

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from sqlalchemy.orm import Session

from backend.database import Base, SessionLocal, engine
from backend.models import (
    Budget,
    BudgetCreate,
    BudgetModel,
    RecurringTransaction,
    RecurringTransactionCreate,
    RecurringTransactionModel,
    SavingsContribution,
    SavingsGoal,
    SavingsGoalCreate,
    SavingsGoalModel,
    Transaction,
    TransactionCreate,
    TransactionModel,
)


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FinSight AI API",
    description="Backend API for the FinSight AI Personal Finance Tracker",
    version="1.0.0",
)

load_dotenv("backend/.env")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

frontend_url = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173",
).rstrip("/")

allowed_origins = list(
    {
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        frontend_url,
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "FinSight AI API is running",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


@app.post(
    "/transactions",
    response_model=Transaction,
    status_code=201,
)
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
):
    new_transaction = TransactionModel(
        description=transaction.description,
        amount=transaction.amount,
        category=transaction.category,
        transaction_type=transaction.transaction_type.value,
        transaction_date=transaction.transaction_date,
    )

    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)

    return new_transaction


@app.get(
    "/transactions",
    response_model=list[Transaction],
)
def get_transactions(
    db: Session = Depends(get_db),
):
    return (
        db.query(TransactionModel)
        .order_by(TransactionModel.transaction_date.desc())
        .all()
    )


@app.get(
    "/transactions/{transaction_id}",
    response_model=Transaction,
)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
):
    transaction = (
        db.query(TransactionModel)
        .filter(TransactionModel.id == transaction_id)
        .first()
    )

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    return transaction


@app.put(
    "/transactions/{transaction_id}",
    response_model=Transaction,
)
def update_transaction(
    transaction_id: int,
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
):
    existing_transaction = (
        db.query(TransactionModel)
        .filter(TransactionModel.id == transaction_id)
        .first()
    )

    if existing_transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    existing_transaction.description = transaction.description
    existing_transaction.amount = transaction.amount
    existing_transaction.category = transaction.category
    existing_transaction.transaction_type = (
        transaction.transaction_type.value
    )
    existing_transaction.transaction_date = transaction.transaction_date

    db.commit()
    db.refresh(existing_transaction)

    return existing_transaction


@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
):
    transaction = (
        db.query(TransactionModel)
        .filter(TransactionModel.id == transaction_id)
        .first()
    )

    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found",
        )

    db.delete(transaction)
    db.commit()

    return {
        "message": "Transaction deleted successfully",
        "id": transaction_id,
    }


@app.post(
    "/budgets",
    response_model=Budget,
    status_code=201,
)
def create_budget(
    budget: BudgetCreate,
    db: Session = Depends(get_db),
):
    existing_budget = (
        db.query(BudgetModel)
        .filter(BudgetModel.category == budget.category)
        .first()
    )

    if existing_budget is not None:
        raise HTTPException(
            status_code=409,
            detail="A budget already exists for this category",
        )

    new_budget = BudgetModel(
        category=budget.category,
        monthly_limit=budget.monthly_limit,
    )

    db.add(new_budget)
    db.commit()
    db.refresh(new_budget)

    return new_budget


@app.get(
    "/budgets",
    response_model=list[Budget],
)
def get_budgets(
    db: Session = Depends(get_db),
):
    return (
        db.query(BudgetModel)
        .order_by(BudgetModel.category.asc())
        .all()
    )


@app.get("/ai/insights")
def get_financial_insights(
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(TransactionModel)
        .order_by(TransactionModel.transaction_date.desc())
        .all()
    )

    if not transactions:
        return {
            "insight": (
                "Add some transactions to receive "
                "AI-powered financial insights."
            )
        }

    transaction_summary = "\n".join(
        [
            (
                f"{transaction.transaction_date} | "
                f"{transaction.transaction_type} | "
                f"{transaction.category} | "
                f"{transaction.description} | "
                f"${transaction.amount:.2f}"
            )
            for transaction in transactions
        ]
    )

    prompt = f"""
You are a helpful personal finance analysis assistant.

Review the following transaction history:

{transaction_summary}

Provide a concise financial analysis that includes:
1. The biggest spending categories.
2. Any noticeable spending trends.
3. Two practical ways the user could improve cash flow.
4. One positive observation.

Do not provide tax, legal, investment, or credit advice.
Keep the response clear and practical.
"""

    try:
        response = client.responses.create(
            model="gpt-5.5",
            input=prompt,
        )

        return {
            "insight": response.output_text,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate AI insights: {str(exc)}",
        ) from exc

@app.post(
    "/recurring-transactions",
    response_model=RecurringTransaction,
    status_code=201,
)
def create_recurring_transaction(
    recurring_transaction: RecurringTransactionCreate,
    db: Session = Depends(get_db),
):
    new_recurring_transaction = RecurringTransactionModel(
        description=recurring_transaction.description,
        amount=recurring_transaction.amount,
        category=recurring_transaction.category,
        transaction_type=recurring_transaction.transaction_type.value,
        frequency=recurring_transaction.frequency.value,
        next_due_date=recurring_transaction.next_due_date,
        is_active=recurring_transaction.is_active,
    )

    db.add(new_recurring_transaction)
    db.commit()
    db.refresh(new_recurring_transaction)

    return new_recurring_transaction


@app.get(
    "/recurring-transactions",
    response_model=list[RecurringTransaction],
)
def get_recurring_transactions(
    db: Session = Depends(get_db),
):
    return (
        db.query(RecurringTransactionModel)
        .order_by(RecurringTransactionModel.next_due_date.asc())
        .all()
    )


@app.put(
    "/recurring-transactions/{recurring_transaction_id}",
    response_model=RecurringTransaction,
)
def update_recurring_transaction(
    recurring_transaction_id: int,
    recurring_transaction: RecurringTransactionCreate,
    db: Session = Depends(get_db),
):
    existing = (
        db.query(RecurringTransactionModel)
        .filter(
            RecurringTransactionModel.id
            == recurring_transaction_id
        )
        .first()
    )

    if existing is None:
        raise HTTPException(
            status_code=404,
            detail="Recurring transaction not found",
        )

    existing.description = recurring_transaction.description
    existing.amount = recurring_transaction.amount
    existing.category = recurring_transaction.category
    existing.transaction_type = (
        recurring_transaction.transaction_type.value
    )
    existing.frequency = recurring_transaction.frequency.value
    existing.next_due_date = recurring_transaction.next_due_date
    existing.is_active = recurring_transaction.is_active

    db.commit()
    db.refresh(existing)

    return existing


@app.delete(
    "/recurring-transactions/{recurring_transaction_id}"
)
def delete_recurring_transaction(
    recurring_transaction_id: int,
    db: Session = Depends(get_db),
):
    recurring_transaction = (
        db.query(RecurringTransactionModel)
        .filter(
            RecurringTransactionModel.id
            == recurring_transaction_id
        )
        .first()
    )

    if recurring_transaction is None:
        raise HTTPException(
            status_code=404,
            detail="Recurring transaction not found",
        )

    db.delete(recurring_transaction)
    db.commit()

    return {
        "message": "Recurring transaction deleted successfully",
        "id": recurring_transaction_id,
    }


@app.get("/cash-flow/forecast")
def get_cash_flow_forecast(
    db: Session = Depends(get_db),
):
    transactions = db.query(TransactionModel).all()
    recurring_transactions = (
        db.query(RecurringTransactionModel)
        .filter(RecurringTransactionModel.is_active.is_(True))
        .all()
    )

    current_balance = sum(
        transaction.amount
        if transaction.transaction_type == "income"
        else -transaction.amount
        for transaction in transactions
    )

    frequency_multipliers = {
        "weekly": 52 / 12,
        "biweekly": 26 / 12,
        "monthly": 1,
        "yearly": 1 / 12,
    }

    projected_income = 0.0
    projected_expenses = 0.0

    for recurring_transaction in recurring_transactions:
        monthly_amount = (
            recurring_transaction.amount
            * frequency_multipliers.get(
                recurring_transaction.frequency,
                1,
            )
        )

        if recurring_transaction.transaction_type == "income":
            projected_income += monthly_amount
        else:
            projected_expenses += monthly_amount

    projected_net_cash_flow = (
        projected_income - projected_expenses
    )
    projected_ending_balance = (
        current_balance + projected_net_cash_flow
    )

    return {
        "current_balance": round(current_balance, 2),
        "projected_monthly_income": round(
            projected_income,
            2,
        ),
        "projected_monthly_expenses": round(
            projected_expenses,
            2,
        ),
        "projected_net_cash_flow": round(
            projected_net_cash_flow,
            2,
        ),
        "projected_ending_balance": round(
            projected_ending_balance,
            2,
        ),
        "active_recurring_transactions": len(
            recurring_transactions
        ),
    }

@app.put(
    "/budgets/{budget_id}",
    response_model=Budget,
)
def update_budget(
    budget_id: int,
    budget: BudgetCreate,
    db: Session = Depends(get_db),
):
    existing_budget = (
        db.query(BudgetModel)
        .filter(BudgetModel.id == budget_id)
        .first()
    )

    if existing_budget is None:
        raise HTTPException(
            status_code=404,
            detail="Budget not found",
        )

    duplicate_budget = (
        db.query(BudgetModel)
        .filter(
            BudgetModel.category == budget.category,
            BudgetModel.id != budget_id,
        )
        .first()
    )

    if duplicate_budget is not None:
        raise HTTPException(
            status_code=409,
            detail="A budget already exists for this category",
        )

    existing_budget.category = budget.category
    existing_budget.monthly_limit = budget.monthly_limit

    db.commit()
    db.refresh(existing_budget)

    return existing_budget


@app.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
):
    budget = (
        db.query(BudgetModel)
        .filter(BudgetModel.id == budget_id)
        .first()
    )

    if budget is None:
        raise HTTPException(
            status_code=404,
            detail="Budget not found",
        )

    db.delete(budget)
    db.commit()

    return {
        "message": "Budget deleted successfully",
        "id": budget_id,
    }


@app.post(
    "/savings-goals",
    response_model=SavingsGoal,
    status_code=201,
)
def create_savings_goal(
    goal: SavingsGoalCreate,
    db: Session = Depends(get_db),
):
    if goal.current_amount > goal.target_amount:
        raise HTTPException(
            status_code=400,
            detail="Current amount cannot exceed the target amount",
        )

    new_goal = SavingsGoalModel(
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        target_date=goal.target_date,
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return new_goal


@app.get(
    "/savings-goals",
    response_model=list[SavingsGoal],
)
def get_savings_goals(
    db: Session = Depends(get_db),
):
    return db.query(SavingsGoalModel).order_by(SavingsGoalModel.id.desc()).all()


@app.put(
    "/savings-goals/{goal_id}",
    response_model=SavingsGoal,
)
def update_savings_goal(
    goal_id: int,
    goal: SavingsGoalCreate,
    db: Session = Depends(get_db),
):
    existing_goal = (
        db.query(SavingsGoalModel)
        .filter(SavingsGoalModel.id == goal_id)
        .first()
    )

    if existing_goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")

    if goal.current_amount > goal.target_amount:
        raise HTTPException(
            status_code=400,
            detail="Current amount cannot exceed the target amount",
        )

    existing_goal.name = goal.name
    existing_goal.target_amount = goal.target_amount
    existing_goal.current_amount = goal.current_amount
    existing_goal.target_date = goal.target_date
    db.commit()
    db.refresh(existing_goal)
    return existing_goal


@app.post(
    "/savings-goals/{goal_id}/contribute",
    response_model=SavingsGoal,
)
def contribute_to_savings_goal(
    goal_id: int,
    contribution: SavingsContribution,
    db: Session = Depends(get_db),
):
    goal = (
        db.query(SavingsGoalModel)
        .filter(SavingsGoalModel.id == goal_id)
        .first()
    )

    if goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")

    goal.current_amount = min(
        goal.current_amount + contribution.amount,
        goal.target_amount,
    )
    db.commit()
    db.refresh(goal)
    return goal


@app.post(
    "/savings-goals/{goal_id}/withdraw",
    response_model=SavingsGoal,
)
def withdraw_from_savings_goal(
    goal_id: int,
    contribution: SavingsContribution,
    db: Session = Depends(get_db),
):
    goal = (
        db.query(SavingsGoalModel)
        .filter(SavingsGoalModel.id == goal_id)
        .first()
    )

    if goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")

    if contribution.amount > goal.current_amount:
        raise HTTPException(
            status_code=400,
            detail="Withdrawal cannot exceed the saved amount",
        )

    goal.current_amount -= contribution.amount
    db.commit()
    db.refresh(goal)
    return goal


@app.delete("/savings-goals/{goal_id}")
def delete_savings_goal(
    goal_id: int,
    db: Session = Depends(get_db),
):
    goal = (
        db.query(SavingsGoalModel)
        .filter(SavingsGoalModel.id == goal_id)
        .first()
    )

    if goal is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")

    db.delete(goal)
    db.commit()
    return {"message": "Savings goal deleted successfully", "id": goal_id}

