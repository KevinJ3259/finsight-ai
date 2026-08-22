from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import Base, SessionLocal, engine
from backend.models import Transaction, TransactionCreate, TransactionModel


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="FinSight AI API",
    description="Backend API for the FinSight AI Personal Finance Tracker",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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
        "status": "success"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.post("/transactions", response_model=Transaction, status_code=201)
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


@app.get("/transactions", response_model=list[Transaction])
def get_transactions(db: Session = Depends(get_db)):
    return (
        db.query(TransactionModel)
        .order_by(TransactionModel.transaction_date.desc())
        .all()
    )

@app.get("/transactions/{transaction_id}", response_model=Transaction)
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

@app.put("/transactions/{transaction_id}", response_model=Transaction)
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
    existing_transaction.transaction_type = transaction.transaction_type.value
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