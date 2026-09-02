import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from sqlalchemy.orm import Session

from backend.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
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
    Token,
    Transaction,
    TransactionCreate,
    TransactionModel,
    User,
    UserCreate,
    UserLogin,
    UserModel,
)


load_dotenv("backend/.env")
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FinSight AI API",
    description="Backend API for the FinSight AI Personal Finance Tracker",
    version="2.0.0",
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
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
    return {"message": "FinSight AI API is running", "status": "success"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/auth/register", response_model=Token, status_code=201)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.lower().strip()
    existing = db.query(UserModel).filter(UserModel.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email is already registered")

    new_user = UserModel(
        name=user.name.strip(),
        email=email,
        hashed_password=hash_password(user.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return Token(
        access_token=create_access_token(new_user.id),
        user=User.model_validate(new_user),
    )


@app.post("/auth/login", response_model=Token)
def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    email = credentials.email.lower().strip()
    user = db.query(UserModel).filter(UserModel.email == email).first()
    if user is None or not verify_password(
        credentials.password, user.hashed_password
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return Token(
        access_token=create_access_token(user.id),
        user=User.model_validate(user),
    )


@app.get("/auth/me", response_model=User)
def get_authenticated_user(current_user: UserModel = Depends(get_current_user)):
    return current_user


@app.post("/transactions", response_model=Transaction, status_code=201)
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = TransactionModel(
        user_id=current_user.id,
        description=transaction.description,
        amount=transaction.amount,
        category=transaction.category,
        transaction_type=transaction.transaction_type.value,
        transaction_date=transaction.transaction_date,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/transactions", response_model=list[Transaction])
def get_transactions(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return (
        db.query(TransactionModel)
        .filter(TransactionModel.user_id == current_user.id)
        .order_by(TransactionModel.transaction_date.desc())
        .all()
    )


def find_transaction(db: Session, transaction_id: int, user_id: int):
    record = (
        db.query(TransactionModel)
        .filter(
            TransactionModel.id == transaction_id,
            TransactionModel.user_id == user_id,
        )
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return record


@app.get("/transactions/{transaction_id}", response_model=Transaction)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return find_transaction(db, transaction_id, current_user.id)


@app.put("/transactions/{transaction_id}", response_model=Transaction)
def update_transaction(
    transaction_id: int,
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_transaction(db, transaction_id, current_user.id)
    record.description = transaction.description
    record.amount = transaction.amount
    record.category = transaction.category
    record.transaction_type = transaction.transaction_type.value
    record.transaction_date = transaction.transaction_date
    db.commit()
    db.refresh(record)
    return record


@app.delete("/transactions/{transaction_id}")
def delete_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_transaction(db, transaction_id, current_user.id)
    db.delete(record)
    db.commit()
    return {"message": "Transaction deleted successfully", "id": transaction_id}


@app.post("/budgets", response_model=Budget, status_code=201)
def create_budget(
    budget: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    existing = (
        db.query(BudgetModel)
        .filter(
            BudgetModel.user_id == current_user.id,
            BudgetModel.category == budget.category,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A budget already exists for this category",
        )
    record = BudgetModel(
        user_id=current_user.id,
        category=budget.category,
        monthly_limit=budget.monthly_limit,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/budgets", response_model=list[Budget])
def get_budgets(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return (
        db.query(BudgetModel)
        .filter(BudgetModel.user_id == current_user.id)
        .order_by(BudgetModel.category.asc())
        .all()
    )


def find_budget(db: Session, budget_id: int, user_id: int):
    record = (
        db.query(BudgetModel)
        .filter(BudgetModel.id == budget_id, BudgetModel.user_id == user_id)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    return record


@app.put("/budgets/{budget_id}", response_model=Budget)
def update_budget(
    budget_id: int,
    budget: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_budget(db, budget_id, current_user.id)
    duplicate = (
        db.query(BudgetModel)
        .filter(
            BudgetModel.user_id == current_user.id,
            BudgetModel.category == budget.category,
            BudgetModel.id != budget_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="A budget already exists for this category",
        )
    record.category = budget.category
    record.monthly_limit = budget.monthly_limit
    db.commit()
    db.refresh(record)
    return record


@app.delete("/budgets/{budget_id}")
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_budget(db, budget_id, current_user.id)
    db.delete(record)
    db.commit()
    return {"message": "Budget deleted successfully", "id": budget_id}


@app.post(
    "/recurring-transactions",
    response_model=RecurringTransaction,
    status_code=201,
)
def create_recurring_transaction(
    item: RecurringTransactionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = RecurringTransactionModel(
        user_id=current_user.id,
        description=item.description,
        amount=item.amount,
        category=item.category,
        transaction_type=item.transaction_type.value,
        frequency=item.frequency.value,
        next_due_date=item.next_due_date,
        is_active=item.is_active,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/recurring-transactions", response_model=list[RecurringTransaction])
def get_recurring_transactions(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return (
        db.query(RecurringTransactionModel)
        .filter(RecurringTransactionModel.user_id == current_user.id)
        .order_by(RecurringTransactionModel.next_due_date.asc())
        .all()
    )


def find_recurring(db: Session, item_id: int, user_id: int):
    record = (
        db.query(RecurringTransactionModel)
        .filter(
            RecurringTransactionModel.id == item_id,
            RecurringTransactionModel.user_id == user_id,
        )
        .first()
    )
    if record is None:
        raise HTTPException(
            status_code=404, detail="Recurring transaction not found"
        )
    return record


@app.put(
    "/recurring-transactions/{recurring_transaction_id}",
    response_model=RecurringTransaction,
)
def update_recurring_transaction(
    recurring_transaction_id: int,
    item: RecurringTransactionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_recurring(db, recurring_transaction_id, current_user.id)
    record.description = item.description
    record.amount = item.amount
    record.category = item.category
    record.transaction_type = item.transaction_type.value
    record.frequency = item.frequency.value
    record.next_due_date = item.next_due_date
    record.is_active = item.is_active
    db.commit()
    db.refresh(record)
    return record


@app.delete("/recurring-transactions/{recurring_transaction_id}")
def delete_recurring_transaction(
    recurring_transaction_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_recurring(db, recurring_transaction_id, current_user.id)
    db.delete(record)
    db.commit()
    return {
        "message": "Recurring transaction deleted successfully",
        "id": recurring_transaction_id,
    }


@app.get("/cash-flow/forecast")
def get_cash_flow_forecast(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    transactions = (
        db.query(TransactionModel)
        .filter(TransactionModel.user_id == current_user.id)
        .all()
    )
    recurring = (
        db.query(RecurringTransactionModel)
        .filter(
            RecurringTransactionModel.user_id == current_user.id,
            RecurringTransactionModel.is_active.is_(True),
        )
        .all()
    )
    current_balance = sum(
        item.amount if item.transaction_type == "income" else -item.amount
        for item in transactions
    )
    multipliers = {
        "weekly": 52 / 12,
        "biweekly": 26 / 12,
        "monthly": 1,
        "yearly": 1 / 12,
    }
    income = 0.0
    expenses = 0.0
    for item in recurring:
        monthly_amount = item.amount * multipliers.get(item.frequency, 1)
        if item.transaction_type == "income":
            income += monthly_amount
        else:
            expenses += monthly_amount
    net = income - expenses
    return {
        "current_balance": round(current_balance, 2),
        "projected_monthly_income": round(income, 2),
        "projected_monthly_expenses": round(expenses, 2),
        "projected_net_cash_flow": round(net, 2),
        "projected_ending_balance": round(current_balance + net, 2),
        "active_recurring_transactions": len(recurring),
    }


@app.post("/savings-goals", response_model=SavingsGoal, status_code=201)
def create_savings_goal(
    goal: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    if goal.current_amount > goal.target_amount:
        raise HTTPException(
            status_code=400,
            detail="Current amount cannot exceed the target amount",
        )
    record = SavingsGoalModel(
        user_id=current_user.id,
        name=goal.name,
        target_amount=goal.target_amount,
        current_amount=goal.current_amount,
        target_date=goal.target_date,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@app.get("/savings-goals", response_model=list[SavingsGoal])
def get_savings_goals(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    return (
        db.query(SavingsGoalModel)
        .filter(SavingsGoalModel.user_id == current_user.id)
        .order_by(SavingsGoalModel.id.desc())
        .all()
    )


def find_goal(db: Session, goal_id: int, user_id: int):
    record = (
        db.query(SavingsGoalModel)
        .filter(
            SavingsGoalModel.id == goal_id,
            SavingsGoalModel.user_id == user_id,
        )
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Savings goal not found")
    return record


@app.put("/savings-goals/{goal_id}", response_model=SavingsGoal)
def update_savings_goal(
    goal_id: int,
    goal: SavingsGoalCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_goal(db, goal_id, current_user.id)
    if goal.current_amount > goal.target_amount:
        raise HTTPException(
            status_code=400,
            detail="Current amount cannot exceed the target amount",
        )
    record.name = goal.name
    record.target_amount = goal.target_amount
    record.current_amount = goal.current_amount
    record.target_date = goal.target_date
    db.commit()
    db.refresh(record)
    return record


@app.post("/savings-goals/{goal_id}/contribute", response_model=SavingsGoal)
def contribute_to_savings_goal(
    goal_id: int,
    contribution: SavingsContribution,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_goal(db, goal_id, current_user.id)
    record.current_amount = min(
        record.current_amount + contribution.amount, record.target_amount
    )
    db.commit()
    db.refresh(record)
    return record


@app.post("/savings-goals/{goal_id}/withdraw", response_model=SavingsGoal)
def withdraw_from_savings_goal(
    goal_id: int,
    contribution: SavingsContribution,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_goal(db, goal_id, current_user.id)
    if contribution.amount > record.current_amount:
        raise HTTPException(
            status_code=400,
            detail="Withdrawal cannot exceed the saved amount",
        )
    record.current_amount -= contribution.amount
    db.commit()
    db.refresh(record)
    return record


@app.delete("/savings-goals/{goal_id}")
def delete_savings_goal(
    goal_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    record = find_goal(db, goal_id, current_user.id)
    db.delete(record)
    db.commit()
    return {"message": "Savings goal deleted successfully", "id": goal_id}


@app.get("/ai/insights")
def get_financial_insights(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    transactions = (
        db.query(TransactionModel)
        .filter(TransactionModel.user_id == current_user.id)
        .order_by(TransactionModel.transaction_date.desc())
        .all()
    )
    if not transactions:
        return {
            "insight": "Add some transactions to receive AI-powered financial insights."
        }
    summary = "\n".join(
        f"{item.transaction_date} | {item.transaction_type} | "
        f"{item.category} | {item.description} | ${item.amount:.2f}"
        for item in transactions
    )
    prompt = f"""
You are a helpful personal finance analysis assistant.

Review the following transaction history:

{summary}

Provide a concise financial analysis that includes:
1. The biggest spending categories.
2. Any noticeable spending trends.
3. Two practical ways the user could improve cash flow.
4. One positive observation.

Do not provide tax, legal, investment, or credit advice.
Keep the response clear and practical.
"""
    try:
        response = client.responses.create(model="gpt-5.5", input=prompt)
        return {"insight": response.output_text}
    except Exception as exc:
        print(
            "AI insight generation failed:",
            type(exc).__name__,
        )
        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to generate AI insights right now. "
                "Please try again later."
            ),
        ) from exc


